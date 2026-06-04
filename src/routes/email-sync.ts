import { Router, Request, Response } from "express";
import { Email } from "../models/email";
import { EmailAccount } from "../models/email-account";
import { Rfq } from "../models/rfq";
import { fetchShippingThreads, deltaSyncGmail, getGmailHistoryId, GmailThread } from "../lib/gmail-api";
import { extractWithClaude, preClassifyEmail } from "../lib/ai-extract";
import { resolveContact } from "../lib/resolve-contact";
import { extractForwardedSender } from "../lib/forwarded-sender";
import { resolveSender } from "../lib/resolve-sender";
import { fetchShippingEmails, deltaSyncOutlook, getInitialDeltaLink, GraphThread } from "../lib/microsoft-graph";
import { getValidToken } from "../lib/microsoft-oauth";
import { createOpportunityFromRfq } from "../lib/create-opportunity";
import crypto from "crypto";

const router = Router();

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
    const sender = resolveSender({ fromName: effectiveFromName, fromEmail: effectiveFromEmail, body: threadText }, s.fields);
    const rfq = await Rfq.create({
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
      resolvedSenderName: sender.name,
      resolvedSenderEmail: sender.email,
    });

    // Auto-create opportunity from customer RFQs
    await createOpportunityFromRfq({
      rfqId: rfq._id,
      companyId: crm.companyId,
      contactId: crm.contactId,
      fields: s.fields,
      emailType: resolvedType,
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
      } else if (account.provider === "outlook" && account.authType === "oauth2") {
        // Outlook via Microsoft Graph API
        // For shared mailboxes, find donor account for token
        let tokenAccount = account;
        if (account.shared) {
          const donor = await EmailAccount.findOne({
            provider: "outlook", authType: "oauth2", active: true, shared: { $ne: true },
          });
          if (donor) tokenAccount = donor;
        }

        const tokenResult = await getValidToken(tokenAccount);
        const accessToken = tokenResult.accessToken;

        // Persist new refresh token + expiry if token was refreshed
        if (tokenResult.refreshed) {
          tokenAccount.accessToken = tokenResult.accessToken;
          if (tokenResult.refreshToken) tokenAccount.refreshToken = tokenResult.refreshToken;
          if (tokenResult.expiresAt) tokenAccount.tokenExpiresAt = tokenResult.expiresAt;
          await tokenAccount.save();
        }

        const mailbox = account.shared ? account.email : undefined;

        let graphThreads: GraphThread[];

        if (account.cursor) {
          // Incremental delta sync
          try {
            const delta = await deltaSyncOutlook(accessToken, account.cursor, { mailbox });
            graphThreads = delta.threads;
            account.cursor = delta.newDeltaLink;
          } catch (deltaErr: any) {
            // Delta link expired — do full sync
            console.warn(`[OUTLOOK] Delta sync failed for ${account.email}, doing full sync: ${deltaErr.message}`);
            graphThreads = await fetchShippingEmails(accessToken, { mailbox, maxMessages: 200, daysBack: 60 });
            const newDelta = await getInitialDeltaLink(accessToken, { mailbox });
            account.cursor = newDelta;
          }
        } else {
          // Initial full sync
          graphThreads = await fetchShippingEmails(accessToken, { mailbox, maxMessages: 200, daysBack: 60 });
          try {
            const deltaLink = await getInitialDeltaLink(accessToken, { mailbox });
            account.cursor = deltaLink;
          } catch (e) {
            console.warn(`[OUTLOOK] Could not get delta link for ${account.email}`);
          }
        }

        // Process each thread (reuse same pipeline as Gmail)
        for (const thread of graphThreads) {
          try {
            const firstMsg = thread.messages[0];
            if (!firstMsg) continue;

            // Check if already ingested
            const uid = `outlook:${thread.conversationId}`;
            const existingEmail = await Email.findOne({ uid });
            if (existingEmail) { totalSkipped++; continue; }

            // Combine thread text
            const threadText = thread.messages
              .map(m => `From: ${m.from} <${m.fromEmail}>\nDate: ${m.sentAt.toISOString()}\nSubject: ${m.subject}\n\n${m.bodyText}`)
              .join("\n\n──────────────\n\n");

            // Layer 1: Replace @oneport365.com sender
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
              totalSkipped++;
              continue;
            }

            // Claude extraction
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
              await Email.create({
                uid,
                fromName: effectiveFromName,
                fromEmail: effectiveFromEmail,
                subject: thread.subject,
                body: threadText,
                emailType: "unknown",
                receivedAt: thread.lastMessageAt,
                messageId: thread.conversationId,
                cc: firstMsg.cc || undefined,
                receivedInbox: account.label || account.email,
                extractionStatus: "failed",
                extractionError: extraction.error,
              });
              console.error(`[OUTLOOK] Extraction failed for "${thread.subject.slice(0, 50)}": ${extraction.error}`);
              totalSkipped++;
              continue;
            }

            const resolvedType = extraction.detectedEmailType || "customer-rfq";
            if (resolvedType !== "customer-rfq" && resolvedType !== "internal-rfq") {
              totalSkipped++;
              continue;
            }

            // Check freight match
            const hasRoute = extraction.shipments.some(s =>
              s.fields.some(f => (f.k === "POL" || f.k === "POD") && f.ok)
            );
            if (!hasRoute) { totalSkipped++; continue; }

            // CRM contact
            const crm = await resolveContact({
              email: effectiveFromEmail,
              name: effectiveFromName,
              source: "email",
            });

            // Save email
            const emailDoc = await Email.create({
              uid,
              fromName: effectiveFromName,
              fromEmail: effectiveFromEmail,
              subject: thread.subject,
              body: threadText,
              emailType: resolvedType,
              receivedAt: thread.lastMessageAt,
              messageId: thread.conversationId,
              cc: firstMsg.cc || undefined,
              receivedInbox: account.label || account.email,
              contactId: crm.contactId,
            });

            // Create RFQs
            const isGroup = extraction.shipments.length > 1;
            const groupId = isGroup ? crypto.randomUUID() : undefined;

            for (let idx = 0; idx < extraction.shipments.length; idx++) {
              const s = extraction.shipments[idx];
              const sender = resolveSender(
                { fromName: effectiveFromName, fromEmail: effectiveFromEmail, body: threadText },
                s.fields
              );
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
                sourceMessageId: thread.conversationId,
                companyId: crm.companyId || undefined,
                contactId: crm.contactId,
                resolvedSenderName: sender.name,
                resolvedSenderEmail: sender.email,
              });
            }

            totalSynced++;
          } catch (threadErr: any) {
            console.error(`[OUTLOOK] Error processing thread ${thread.conversationId}:`, threadErr.message);
          }
        }

        account.lastSyncedAt = new Date();
        account.lastError = undefined;
        await account.save();
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
