import { Router, Request, Response } from "express";
import { Email } from "../models/email";
import { EmailAccount } from "../models/email-account";
import { Rfq } from "../models/rfq";
import { fetchShippingThreads, deltaSyncGmail, getGmailHistoryId, GmailThread } from "../lib/gmail-api";
import { extractWithClaude, preClassifyEmail } from "../lib/ai-extract";
import { resolveContact } from "../lib/resolve-contact";
import crypto from "crypto";

const router = Router();

/**
 * Layer 1 of @oneport365.com rule: If the email is from an internal
 * @oneport365.com address, scan the body for the original external sender.
 */
function extractForwardedSender(
  fromEmail: string,
  fromName: string,
  body: string
): { fromEmail: string; fromName: string } {
  if (!fromEmail.toLowerCase().endsWith("@oneport365.com")) {
    return { fromEmail, fromName };
  }
  const angleMatch = body.match(
    /From:\s*([^<\n\r]+?)\s*<([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})>/i
  );
  if (angleMatch && !angleMatch[2].toLowerCase().endsWith("@oneport365.com")) {
    return { fromName: angleMatch[1].trim(), fromEmail: angleMatch[2].toLowerCase() };
  }
  const mailtoMatch = body.match(
    /From:\s*([^[\n\r]+?)\s*\[mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\]/i
  );
  if (mailtoMatch && !mailtoMatch[2].toLowerCase().endsWith("@oneport365.com")) {
    return { fromName: mailtoMatch[1].trim(), fromEmail: mailtoMatch[2].toLowerCase() };
  }
  return { fromEmail, fromName };
}

function generateRef(): string {
  const now = new Date();
  const yymm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `RFQ-${yymm}-${rand}`;
}

async function processThread(
  thread: GmailThread,
  accountLabel: string
): Promise<{ synced: boolean; skipped: boolean }> {
  // Use first message of thread for extraction
  const firstMsg = thread.messages[0];
  if (!firstMsg) return { synced: false, skipped: true };

  // Check if already ingested (by threadId)
  const uid = `gmail:${thread.threadId}`;
  const existing = await Email.findOne({ uid });
  if (existing) return { synced: false, skipped: true };

  // Combine thread text for extraction
  const threadText = thread.messages
    .map((m) => `From: ${m.from} <${m.fromEmail}>\nDate: ${m.sentAt.toISOString()}\nSubject: ${m.subject}\n\n${m.bodyText}`)
    .join("\n\n──────────────\n\n");

  // Layer 1: Replace @oneport365.com sender with forwarded external sender
  const resolved = extractForwardedSender(firstMsg.fromEmail, firstMsg.from, threadText);
  const effectiveFromEmail = resolved.fromEmail;
  const effectiveFromName = resolved.fromName;

  // Pre-classify
  const preClass = preClassifyEmail({
    fromName: effectiveFromName,
    fromEmail: effectiveFromEmail,
    subject: thread.subject,
    body: threadText.slice(0, 3000),
  });

  if (preClass && preClass !== "customer-rfq" && preClass !== "internal-rfq") {
    return { synced: false, skipped: true };
  }

  // Claude extraction on full thread (one call per thread, not per message)
  const extraction = await extractWithClaude(
    {
      fromName: effectiveFromName,
      fromEmail: effectiveFromEmail,
      subject: thread.subject,
      body: threadText,
    },
    "customer-rfq"
  );

  if (extraction.status === "error") {
    // Save the email so it can be retried later
    await Email.create({
      uid,
      fromName: effectiveFromName,
      fromEmail: effectiveFromEmail,
      subject: thread.subject,
      body: threadText,
      emailType: "unknown",
      receivedAt: thread.lastMessageAt,
      messageId: thread.threadId,
      cc: firstMsg.cc || undefined,
      receivedInbox: accountLabel,
      extractionStatus: "failed",
      extractionError: extraction.error,
    });
    console.error(`Extraction failed for "${thread.subject.slice(0, 50)}": ${extraction.errorType} — ${extraction.error}`);
    return { synced: false, skipped: true };
  }

  const resolvedType = extraction.detectedEmailType || "customer-rfq";
  if (resolvedType !== "customer-rfq" && resolvedType !== "internal-rfq") {
    return { synced: false, skipped: true };
  }

  // Check freight match — must have POL or POD
  const hasRoute = extraction.shipments.some((s) =>
    s.fields.some((f) => (f.k === "POL" || f.k === "POD") && f.ok)
  );
  if (!hasRoute) {
    return { synced: false, skipped: true };
  }

  // Confirmed freight RFQ — create CRM contact (use effective sender, not internal)
  const crm = await resolveContact({
    email: effectiveFromEmail,
    name: effectiveFromName,
    source: "email",
  });

  // Save the email (thread-level record)
  const emailDoc = await Email.create({
    uid,
    fromName: effectiveFromName,
    fromEmail: effectiveFromEmail,
    subject: thread.subject,
    body: threadText,
    emailType: resolvedType,
    receivedAt: thread.lastMessageAt,
    messageId: thread.threadId,
    cc: firstMsg.cc || undefined,
    receivedInbox: accountLabel,
    contactId: crm.contactId,
  });

  // Create RFQs
  const isGroup = extraction.shipments.length > 1;
  const groupId = isGroup ? crypto.randomUUID() : undefined;

  for (let idx = 0; idx < extraction.shipments.length; idx++) {
    const s = extraction.shipments[idx];
    await Rfq.create({
      emailId: emailDoc._id,
      ref: generateRef(),
      emailType: resolvedType,
      status: s.status as any,
      fields: s.fields,
      missingFields: s.missing,
      followUpDraft: (isGroup
        ? (idx === 0 ? extraction.combinedDraft : undefined)
        : (extraction.combinedDraft || s.draft)) || undefined,
      groupId,
      groupIndex: isGroup ? idx + 1 : undefined,
      groupTotal: isGroup ? extraction.shipments.length : undefined,
      sourceMessageId: thread.threadId,
      companyId: crm.companyId || undefined,
      contactId: crm.contactId,
    });
  }

  return { synced: true, skipped: false };
}

// POST /api/emails/sync — sync all connected accounts
router.post("/emails/sync", async (_req: Request, res: Response) => {
  const accounts = await EmailAccount.find({ active: true });

  if (!accounts.length) {
    res.json({ synced: 0, skipped: 0, errors: ["No email accounts configured"] });
    return;
  }

  let totalSynced = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      if (account.provider === "gmail" && account.authType === "oauth2" && account.refreshToken) {
        // Gmail API sync
        let threads: GmailThread[];

        if (account.cursor) {
          // Incremental sync via history API
          const delta = await deltaSyncGmail(account.refreshToken, account.cursor);
          threads = delta.threads;
          account.cursor = delta.newHistoryId;
        } else {
          // Initial sync — fetch shipping threads
          threads = await fetchShippingThreads(account.refreshToken, { maxThreads: 100 });
          const historyId = await getGmailHistoryId(account.refreshToken);
          account.cursor = historyId;
        }

        // Process each thread
        for (const thread of threads) {
          try {
            const result = await processThread(thread, account.label || account.email);
            if (result.synced) totalSynced++;
            if (result.skipped) totalSkipped++;
          } catch (err) {
            console.error(`Error processing thread ${thread.threadId}:`, err);
          }
        }

        account.lastSyncedAt = new Date();
        account.lastError = undefined;
        await account.save();
      } else if (account.provider === "gmail" && account.authType === "password") {
        // Legacy IMAP Gmail — skip, user should reconnect via OAuth
        errors.push(`${account.email}: Please reconnect via Google OAuth (app passwords no longer supported)`);
      } else if (account.provider === "outlook") {
        // Phase 2 — Graph API (not yet implemented)
        errors.push(`${account.email}: Outlook Graph API sync coming soon`);
      }
    } catch (err: any) {
      const errMsg = `${account.label || account.email}: ${err.message}`;
      errors.push(errMsg);
      account.lastError = err.message;
      await account.save();
    }
  }

  res.json({ synced: totalSynced, skipped: totalSkipped, accountsChecked: accounts.length, errors });
});

// GET /api/emails/status — check account connection status
router.get("/emails/status", async (_req: Request, res: Response) => {
  const accounts = await EmailAccount.find({ active: true });
  const results = accounts.map((acc) => ({
    email: acc.email,
    provider: acc.provider,
    authType: acc.authType,
    ok: !!acc.refreshToken && acc.authType === "oauth2",
    lastSyncedAt: acc.lastSyncedAt,
    lastError: acc.lastError,
    hasCursor: !!acc.cursor,
  }));
  res.json(results);
});

export { router as emailSyncRouter };
