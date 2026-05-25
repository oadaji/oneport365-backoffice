import { Router, Request, Response } from "express";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { Readable } from "stream";
import nodemailer from "nodemailer";
import { Email } from "../models/email";
import { EmailAccount } from "../models/email-account";
import { Rfq } from "../models/rfq";
import { isAutomatedEmail, normaliseMessageId } from "../lib/email-filters";
import { extractWithClaude, preClassifyEmail } from "../lib/ai-extract";
import { resolveContact } from "../lib/resolve-contact";
import { extractForwardedSender } from "../lib/forwarded-sender";
import { resolveSender } from "../lib/resolve-sender";
import { getValidToken, refreshAccessToken } from "../lib/microsoft-oauth";
import { classifyEmail } from "../lib/classifier";
import { fetchOutlookShippingEmails, deltaSync as outlookDeltaSync, GraphMessage } from "../lib/outlook-graph";
import crypto from "crypto";

const router = Router();

function generateRef(): string {
  const now = new Date();
  const yymm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `RFQ-${yymm}-${rand}`;
}

interface SyncAccount {
  id: string;
  email: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  label: string;
  authType: "password" | "oauth2";
  provider?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

async function getAccountsToSync(): Promise<SyncAccount[]> {
  const accounts: SyncAccount[] = [];

  // All accounts from DB (added via Email Monitoring UI)
  const dbAccounts = await EmailAccount.find({ active: true });
  for (const acc of dbAccounts) {
    if (accounts.some((a) => a.email === acc.email)) continue;
    const isOutlook = ["outlook", "hotmail", "live", "msn"].some((d) => acc.email.includes(d));

    const syncAcc: SyncAccount = {
      id: acc._id.toString(),
      email: acc.email,
      host: acc.imapHost || (isOutlook ? "outlook.office365.com" : "imap.gmail.com"),
      port: acc.imapPort || 993,
      user: acc.email,
      pass: acc.password || "",
      label: acc.label || acc.email,
      authType: acc.authType || "password",
      accessToken: acc.accessToken,
      refreshToken: acc.refreshToken,
      tokenExpiresAt: acc.tokenExpiresAt,
    };

    // For OAuth2 accounts, get a valid access token (refresh if needed)
    if (acc.authType === "oauth2" && acc.refreshToken) {
      try {
        const token = await getValidToken(acc);
        syncAcc.accessToken = token;

        // If token was refreshed, persist new tokens
        if (token !== acc.accessToken) {
          const refreshed = await refreshAccessToken(acc.refreshToken);
          await EmailAccount.findByIdAndUpdate(acc._id, {
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            tokenExpiresAt: refreshed.expiresAt,
          });
          syncAcc.accessToken = refreshed.accessToken;
        }
      } catch (err: any) {
        await EmailAccount.findByIdAndUpdate(acc._id, { lastError: `OAuth2 token refresh failed: ${err.message}` });
        continue; // skip this account
      }
    }

    accounts.push(syncAcc);
  }

  return accounts;
}

/** Build an ImapFlow client for the given account */
function createImapClient(account: SyncAccount): ImapFlow {
  if (account.authType === "oauth2" && account.accessToken) {
    return new ImapFlow({
      host: account.host,
      port: account.port,
      secure: true,
      auth: {
        user: account.user,
        accessToken: account.accessToken,
      },
      logger: false,
    });
  }

  return new ImapFlow({
    host: account.host,
    port: account.port,
    secure: true,
    auth: { user: account.user, pass: account.pass },
    logger: false,
  });
}

// POST /api/gmail/sync — sync all configured inboxes
router.post("/gmail/sync", async (req: Request, res: Response) => {
  const maxResults = 500;
  const accounts = await getAccountsToSync();

  if (!accounts.length) {
    res.json({ synced: 0, skipped: 0, errors: ["No email accounts configured"] });
    return;
  }

  let totalSynced = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      // Clear error at start (lastSyncedAt is updated only after successful sync)
      await EmailAccount.findByIdAndUpdate(account.id, { lastError: null });

      // ── Outlook Graph API sync ──
      if (account.authType === "oauth2" && account.provider === "outlook") {
        const dbAccount = await EmailAccount.findById(account.id);
        if (!dbAccount?.refreshToken) { errors.push(`${account.email}: No refresh token`); continue; }

        const graphMessages = await fetchOutlookShippingEmails(dbAccount, { maxMessages: 100 });

        for (const gMsg of graphMessages) {
          try {
            const rawOlkFromEmail = gMsg.from?.emailAddress?.address?.toLowerCase() || "";
            const rawOlkFromName = gMsg.from?.emailAddress?.name || rawOlkFromEmail;
            const subject = gMsg.subject || "(no subject)";
            let body = gMsg.body?.content || gMsg.bodyPreview || "";
            if (gMsg.body?.contentType === "html") {
              body = body.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
            }
            if (body.length > 15000) body = body.slice(0, 15000);

            // Layer 1: Replace @oneport365.com sender with forwarded external sender
            const { fromEmail, fromName } = extractForwardedSender(rawOlkFromEmail, rawOlkFromName, body);

            const uid = `graph:${gMsg.id}`;
            const cc = gMsg.ccRecipients?.map((r: any) => r.emailAddress.address).join(", ") || undefined;

            // Skip automated
            if (isAutomatedEmail({ fromEmail, subject, hasListUnsubscribe: false })) {
              totalSkipped++;
              continue;
            }

            // Stage 2: Local classifier
            const outlookClassification = classifyEmail({ fromEmail, subject, body });
            if (!outlookClassification.shippingRelevant && !outlookClassification.needsClaude) {
              totalSkipped++;
              continue;
            }

            // Already ingested?
            const existing = await Email.findOne({ uid });
            if (existing) { totalSkipped++; continue; }

            // Claude extraction
            const extraction = await extractWithClaude(
              { fromName, fromEmail, subject, body },
              "customer-rfq"
            );

            if (extraction.status === "error") {
              // Save the email so it can be retried later
              await Email.create({
                uid, fromName, fromEmail, subject, body,
                emailType: "unknown",
                receivedAt: new Date(gMsg.receivedDateTime),
                messageId: gMsg.id,
                cc: cc || undefined,
                receivedInbox: account.label || account.email,
                extractionStatus: "failed",
                extractionError: extraction.error,
              });
              console.error(`Extraction failed for "${subject.slice(0, 50)}": ${extraction.errorType} — ${extraction.error}`);
              totalSkipped++;
              continue;
            }

            const resolvedType = extraction.detectedEmailType || "irrelevant";
            if (resolvedType !== "customer-rfq" && resolvedType !== "internal-rfq" && resolvedType !== "rate-reply") {
              totalSkipped++;
              continue;
            }
            if (!extraction.shipments || extraction.shipments.length === 0) {
              totalSkipped++;
              continue;
            }

            // Create CRM contact + email + RFQs
            const crm = await resolveContact({ email: fromEmail, name: fromName, source: "email" });

            const emailDoc = await Email.create({
              uid, fromName, fromEmail, subject,
              body, emailType: resolvedType,
              receivedAt: new Date(gMsg.receivedDateTime),
              messageId: gMsg.id,
              cc: cc || undefined,
              receivedInbox: account.label || account.email,
              contactId: crm.contactId,
            });

            const isGroup = extraction.shipments.length > 1;
            const groupId = isGroup ? crypto.randomUUID() : undefined;

            for (let idx = 0; idx < extraction.shipments.length; idx++) {
              const s = extraction.shipments[idx];
              const sender = resolveSender({ fromName, fromEmail, body }, s.fields);
              await Rfq.create({
                emailId: emailDoc._id,
                ref: generateRef(),
                emailType: resolvedType,
                status: s.status as any,
                fields: s.fields,
                missingFields: s.missing,
                followUpDraft: (isGroup ? (idx === 0 ? extraction.combinedDraft : undefined) : (extraction.combinedDraft || s.draft)) || undefined,
                groupId,
                groupIndex: isGroup ? idx + 1 : undefined,
                groupTotal: isGroup ? extraction.shipments.length : undefined,
                sourceMessageId: gMsg.id,
                companyId: crm.companyId || undefined,
                contactId: crm.contactId,
                resolvedSenderName: sender.name,
                resolvedSenderEmail: sender.email,
              });
            }

            totalSynced++;
          } catch (msgErr) {
            console.error("Error processing Outlook message:", msgErr);
          }
        }

        // Update cursor for delta sync
        try {
          const delta = await outlookDeltaSync(dbAccount);
          if (delta.newCursor) {
            await EmailAccount.findByIdAndUpdate(account.id, { cursor: delta.newCursor });
          }
        } catch { /* delta cursor save is best-effort */ }

        await EmailAccount.findByIdAndUpdate(account.id, { lastSyncedAt: new Date(), lastError: null });
        continue; // Skip IMAP processing
      }

      // ── Gmail IMAP sync ──
      const client = createImapClient(account);

      client.on("error", () => {});
      await client.connect();

      // Reload account to get latest lastSyncedAt
      const freshAccount = await EmailAccount.findById(account.id);

      const lock = await client.getMailboxLock("INBOX");
      try {
        // IMAP SEARCH — server-side filter for shipping emails only
        // First sync: go back 30 days. Subsequent syncs: only since last sync.
        let sinceDate: Date;
        if (freshAccount?.lastSyncedAt) {
          // Subsequent sync — only fetch emails since last sync (with 1 hour buffer)
          sinceDate = new Date(new Date(freshAccount.lastSyncedAt).getTime() - 3600_000);
        } else {
          // First sync — go back 30 days
          sinceDate = new Date(Date.now() - 30 * 86400_000);
        }

        const shippingKeywords = [
          "RFQ", "quote", "freight", "shipment", "shipping", "container",
          "FCL", "LCL", "booking", "rates", "EXW", "FOB", "CIF",
          "bill of lading", "BOL", "quotation", "ETA", "ETD", "DAP",
        ];

        const allUids = new Set<number>();
        for (const keyword of shippingKeywords) {
          try {
            const uids = await client.search({ since: sinceDate, subject: keyword }, { uid: true });
            if (uids) for (const uid of uids) allUids.add(uid);
          } catch { /* some keywords may fail, continue */ }
        }

        if (allUids.size === 0) continue;

        // Cap at maxResults most recent
        const sortedUids = [...allUids].sort((a, b) => a - b).slice(-maxResults);
        const uidRange = sortedUids.join(",");

        for await (const msg of client.fetch(uidRange, { envelope: true, source: true, internalDate: true }, { uid: true })) {
          try {
            const source = msg.source;
            if (!source) continue;
            const parsed = await simpleParser(Readable.from(source));

            const fromAddr = parsed.from?.value?.[0];
            if (!fromAddr?.address) continue;

            const rawFromEmail = fromAddr.address.toLowerCase();
            const rawFromName = fromAddr.name || rawFromEmail;
            const subject = parsed.subject || "(no subject)";
            // Prefer plain text, fall back to stripped HTML. For forwarded emails,
            // the original content is often only in HTML — strip tags and use it.
            let body = parsed.text || "";
            if (parsed.html) {
              const strippedHtml = parsed.html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
              // Use HTML version if it has significantly more content
              if (strippedHtml.length > body.length * 1.5) body = strippedHtml;
            }
            // Truncate to 15000 chars to match extraction limit
            if (typeof body === "string" && body.length > 15000) body = body.slice(0, 15000);

            // Layer 1: Replace @oneport365.com sender with forwarded external sender
            const { fromEmail, fromName } = extractForwardedSender(rawFromEmail, rawFromName, body);

            const messageId = normaliseMessageId(parsed.messageId) || undefined;
            const inReplyTo = normaliseMessageId(parsed.inReplyTo as string) || undefined;
            const cc = parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).map((c: any) => c.text).join(", ") : undefined;

            // Build unique UID
            const uid = messageId ? `mid:${messageId}` : `${account.email}:${msg.seq}`;

            // Skip automated/promotional emails
            const hasListUnsub = parsed.headers?.has("list-unsubscribe") || false;
            if (isAutomatedEmail({ fromEmail, subject, hasListUnsubscribe: hasListUnsub })) {
              totalSkipped++;
              continue;
            }

            // Stage 2: Local classifier — score 0-1
            const classification = classifyEmail({
              fromEmail, subject,
              body: typeof body === "string" ? body : "",
            });

            // Score < 0.4 → definitely not freight, skip without Claude
            if (!classification.shippingRelevant && !classification.needsClaude) {
              totalSkipped++;
              continue;
            }

            // Check if already ingested
            const existing = await Email.findOne({ uid });
            if (existing) {
              totalSkipped++;
              continue;
            }

            // Threading: check if this is a reply to an existing RFQ
            if (inReplyTo) {
              const parentEmail = await Email.findOne({ messageId: inReplyTo });
              if (parentEmail) {
                const parentRfq = await Rfq.findOne({ emailId: parentEmail._id });
                if (parentRfq) {
                  // Save reply email
                  const replyEmail = await Email.create({
                    uid,
                    fromName,
                    fromEmail,
                    subject,
                    body: typeof body === "string" ? body : "",
                    emailType: "customer-rfq",
                    receivedAt: parsed.date || new Date(),
                    messageId,
                    inReplyTo,
                    parentEmailId: parentEmail._id,
                    cc,
                    receivedInbox: account.label,
                    contactId: parentEmail.contactId,
                  });

                  // Re-extract with full thread
                  const thread = `Original:\n${parentEmail.body}\n\n──────────────\nReply:\n${body}`;
                  const extraction = await extractWithClaude(
                    { fromName, fromEmail, subject, body: thread },
                    "customer-rfq"
                  );

                  if (extraction.status === "ok" && extraction.shipments.length > 0) {
                    const s = extraction.shipments[0];
                    await Rfq.findByIdAndUpdate(parentRfq._id, {
                      status: s.status,
                      fields: s.fields,
                      missingFields: s.missing,
                      followUpDraft: extraction.combinedDraft || s.draft,
                    });
                  }

                  totalSynced++;
                  continue;
                }
              }
            }

            // Subject-based threading fallback for "Re:" emails
            if (subject.toLowerCase().startsWith("re:")) {
              const baseSubject = subject.replace(/^(re:\s*)+/i, "").trim();
              const matchEmail = await Email.findOne({
                fromEmail,
                subject: new RegExp(`^${baseSubject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
              }).sort({ _id: -1 });

              if (matchEmail) {
                const matchRfq = await Rfq.findOne({ emailId: matchEmail._id });
                if (matchRfq) {
                  await Email.create({
                    uid, fromName, fromEmail, subject,
                    body: typeof body === "string" ? body : "",
                    emailType: "customer-rfq",
                    receivedAt: parsed.date || new Date(),
                    messageId, inReplyTo, parentEmailId: matchEmail._id,
                    cc, receivedInbox: account.label, contactId: matchEmail.contactId,
                  });

                  const thread = `Original:\n${matchEmail.body}\n\n──────────────\nReply:\n${body}`;
                  const extraction = await extractWithClaude(
                    { fromName, fromEmail, subject, body: thread },
                    "customer-rfq"
                  );

                  if (extraction.status === "ok" && extraction.shipments.length > 0) {
                    const s = extraction.shipments[0];
                    await Rfq.findByIdAndUpdate(matchRfq._id, {
                      status: s.status,
                      fields: s.fields,
                      missingFields: s.missing,
                      followUpDraft: extraction.combinedDraft || s.draft,
                    });
                  }

                  totalSynced++;
                  continue;
                }
              }
            }

            // Claude extraction — process all shipping emails that passed IMAP search
            const extraction = await extractWithClaude(
              { fromName, fromEmail, subject, body: typeof body === "string" ? body : "" },
              "customer-rfq"
            );

            if (extraction.status === "error") {
              // Save the email so it can be retried later
              await Email.create({
                uid, fromName, fromEmail, subject,
                body: typeof body === "string" ? body : "",
                emailType: "unknown",
                receivedAt: parsed.date || new Date(),
                messageId, cc,
                receivedInbox: account.label,
                extractionStatus: "failed",
                extractionError: extraction.error,
              });
              console.error(`Extraction failed for "${subject.slice(0, 50)}": ${extraction.errorType} — ${extraction.error}`);
              totalSkipped++;
              continue;
            }

            const resolvedType = extraction.detectedEmailType || "irrelevant";

            // Only accept actual freight RFQs — skip everything else
            if (resolvedType !== "customer-rfq" && resolvedType !== "internal-rfq" && resolvedType !== "rate-reply") {
              totalSkipped++;
              continue;
            }

            // Skip if no shipments extracted (extraction failed or empty)
            if (!extraction.shipments || extraction.shipments.length === 0) {
              totalSkipped++;
              continue;
            }

            // Create CRM contact and email record for confirmed freight emails
            const crm = await resolveContact({
              email: fromEmail,
              name: fromName,
              source: "email",
            });

            const emailDoc = await Email.create({
              uid, fromName, fromEmail, subject,
              body: typeof body === "string" ? body : "",
              emailType: resolvedType,
              receivedAt: parsed.date || new Date(),
              messageId, cc,
              receivedInbox: account.label,
              contactId: crm.contactId,
            });

            // Create RFQs
            const isGroup = extraction.shipments.length > 1;
            const groupId = isGroup ? crypto.randomUUID() : undefined;

            for (let idx = 0; idx < extraction.shipments.length; idx++) {
              const s = extraction.shipments[idx];
              const sender = resolveSender({ fromName, fromEmail, body: typeof body === "string" ? body : "" }, s.fields);
              await Rfq.create({
                emailId: emailDoc._id,
                ref: generateRef(),
                emailType: resolvedType,
                status: s.status as any,
                fields: s.fields,
                missingFields: s.missing,
                followUpDraft: (isGroup ? (idx === 0 ? extraction.combinedDraft : undefined) : (extraction.combinedDraft || s.draft)) || undefined,
                groupId,
                groupIndex: isGroup ? idx + 1 : undefined,
                groupTotal: isGroup ? extraction.shipments.length : undefined,
                sourceMessageId: messageId || undefined,
                companyId: crm.companyId || undefined,
                contactId: crm.contactId,
                resolvedSenderName: sender.name,
                resolvedSenderEmail: sender.email,
              });
            }

            totalSynced++;
          } catch (msgErr) {
            console.error("Error processing message:", msgErr);
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();

      // Update last synced
      await EmailAccount.findByIdAndUpdate(account.id, { lastSyncedAt: new Date(), lastError: null });
    } catch (accErr: any) {
      const errMsg = `${account.label}: ${accErr.message}`;
      errors.push(errMsg);
      await EmailAccount.findByIdAndUpdate(account.id, { lastError: accErr.message });
    }
  }

  res.json({ synced: totalSynced, skipped: totalSkipped, accountsChecked: accounts.length, errors });
});

// GET /api/gmail/status — test IMAP connections
router.get("/gmail/status", async (_req: Request, res: Response) => {
  const accounts = await getAccountsToSync();
  const results = await Promise.all(
    accounts.map(async (acc) => {
      try {
        const client = createImapClient(acc);
        client.on("error", () => {});
        await client.connect();
        const status = await client.status("INBOX", { messages: true, unseen: true });
        await client.logout();
        return { email: acc.email, ok: true, messages: status.messages, unseen: status.unseen };
      } catch (err: any) {
        return { email: acc.email, ok: false, error: err.message };
      }
    })
  );
  res.json(results);
});

// POST /api/gmail/send — send email via SMTP (Gmail or Outlook OAuth2)
router.post("/gmail/send", async (req: Request, res: Response) => {
  try {
    const { from, to, cc, subject, body } = req.body;
    if (!from) {
      res.status(400).json({ error: "No sender email specified" });
      return;
    }

    const dbAccount = await EmailAccount.findOne({ email: from, active: true });
    if (!dbAccount) {
      res.status(400).json({ error: "Sender account not found — add it via Email Monitoring first" });
      return;
    }

    let transporter: nodemailer.Transporter;

    if (dbAccount.authType === "oauth2" && dbAccount.refreshToken) {
      // Outlook OAuth2 SMTP
      const token = await getValidToken(dbAccount);
      transporter = nodemailer.createTransport({
        host: "smtp.office365.com",
        port: 587,
        secure: false,
        auth: {
          type: "OAuth2",
          user: from,
          accessToken: token,
        },
      } as any);
    } else {
      // Gmail / IMAP app password SMTP
      const isOutlook = dbAccount.provider === "outlook";
      transporter = nodemailer.createTransport({
        host: isOutlook ? "smtp.office365.com" : "smtp.gmail.com",
        port: isOutlook ? 587 : 465,
        secure: !isOutlook,
        auth: { user: from, pass: dbAccount.password },
      });
    }

    await transporter.sendMail({
      from,
      to,
      cc: cc || undefined,
      subject,
      text: body,
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to send email", details: err.message });
  }
});

export { router as gmailRouter };
