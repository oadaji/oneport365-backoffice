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
import { getValidToken } from "../lib/microsoft-oauth";
import { classifyEmail } from "../lib/classifier";
// Graph API imports removed — now using IMAP for all accounts including Outlook OAuth2
import { createOpportunityFromRfq } from "../lib/create-opportunity";
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

  // Find the donor account for shared mailboxes (first non-shared OAuth2 outlook account)
  const donor = dbAccounts.find(a => a.provider === "outlook" && a.authType === "oauth2" && !a.shared && a.refreshToken);

  for (const acc of dbAccounts) {
    if (accounts.some((a) => a.email === acc.email)) continue;
    const isOutlook = acc.provider === "outlook" || ["outlook", "hotmail", "live", "msn"].some((d) => acc.email.includes(d));

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

    // For shared mailboxes, borrow tokens from the donor
    if (acc.shared && acc.authType === "oauth2" && donor) {
      syncAcc.refreshToken = donor.refreshToken;
      syncAcc.accessToken = donor.accessToken;
      syncAcc.tokenExpiresAt = donor.tokenExpiresAt;
    }

    // For OAuth2 accounts, get a valid access token (refresh if needed)
    const refreshToken = syncAcc.refreshToken;
    if (acc.authType === "oauth2" && refreshToken) {
      try {
        const tokenResult = await getValidToken({ accessToken: syncAcc.accessToken, refreshToken, tokenExpiresAt: syncAcc.tokenExpiresAt });
        syncAcc.accessToken = tokenResult.accessToken;

        // If token was refreshed, persist new refresh token + expiry
        if (tokenResult.refreshed) {
          const updateId = acc.shared && donor ? donor._id : acc._id;
          await EmailAccount.findByIdAndUpdate(updateId, {
            accessToken: tokenResult.accessToken,
            refreshToken: tokenResult.refreshToken || refreshToken,
            tokenExpiresAt: tokenResult.expiresAt,
          });
          syncAcc.accessToken = tokenResult.accessToken;
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
  const force = req.query.force === "true";

  // Force resync: clear existing emails/RFQs and reset lastSyncedAt so UIDs are re-processed
  if (force) {
    await Email.deleteMany({});
    await Rfq.deleteMany({});
    await EmailAccount.updateMany({}, { $unset: { lastSyncedAt: 1 } });
  }

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

      // ── IMAP sync (Gmail + Outlook OAuth2) ──
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
        const keywordHits: Record<string, number> = {};
        for (const keyword of shippingKeywords) {
          try {
            const uids = await client.search({ since: sinceDate, subject: keyword }, { uid: true });
            keywordHits[keyword] = Array.isArray(uids) ? uids.length : 0;
            if (uids) for (const uid of uids) allUids.add(uid);
          } catch { /* some keywords may fail, continue */ }
        }

        console.log(`[SYNC DEBUG] account=${account.email} sinceDate=${sinceDate.toISOString()} totalUids=${allUids.size} keywordHits=${JSON.stringify(keywordHits)}`);

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
              let strippedHtml = parsed.html
                // Remove style tags and their content
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
                // Remove script tags and their content
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
                // Remove HTML comments
                .replace(/<!--[\s\S]*?-->/g, " ")
                // Remove all remaining HTML tags
                .replace(/<[^>]+>/g, " ")
                // Remove CSS rules that leak into text (e.g., "P {margin-top:0;...}")
                .replace(/[A-Z]{1,10}\s*\{[^}]*\}/g, " ")
                // First pass: decode HTML entities
                .replace(/&nbsp;/gi, " ")
                .replace(/&lt;/gi, "<")
                .replace(/&gt;/gi, ">")
                .replace(/&amp;/gi, "&")
                .replace(/&quot;/gi, '"')
                .replace(/&#39;/gi, "'")
                .replace(/&apos;/gi, "'")
                .replace(/&#x27;/gi, "'")
                .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
                // Second pass for double-encoded entities (e.g., &amp;lt; -> < )
                .replace(/&lt;/gi, "<")
                .replace(/&gt;/gi, ">")
                .replace(/&amp;/gi, "&")
                // Remove angle brackets around email addresses for cleaner display
                .replace(/<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/g, "[$1]")
                // Remove Outlook image placeholders
                .replace(/<[^>]*\.(png|gif|jpg|jpeg)[^>]*>/gi, " ")
                // Collapse whitespace
                .replace(/\s+/g, " ")
                .trim();
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

            // Subject-based threading fallback for "Re:" emails (30-day window)
            if (subject.toLowerCase().startsWith("re:")) {
              const baseSubject = subject.replace(/^(re:\s*)+/i, "").trim();
              const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);
              const matchEmail = await Email.findOne({
                fromEmail,
                subject: new RegExp(`^${baseSubject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
                receivedAt: { $gte: thirtyDaysAgo },
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
              const rfq = await Rfq.create({
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

              // Auto-create opportunity from customer RFQs
              await createOpportunityFromRfq({
                rfqId: rfq._id,
                companyId: crm.companyId,
                contactId: crm.contactId,
                fields: s.fields,
                emailType: resolvedType,
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

  res.json({ synced: totalSynced, skipped: totalSkipped, accountsChecked: accounts.length, errors, force });
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
      const tokenResult = await getValidToken(dbAccount);
      if (tokenResult.refreshed) {
        dbAccount.accessToken = tokenResult.accessToken;
        if (tokenResult.refreshToken) dbAccount.refreshToken = tokenResult.refreshToken;
        if (tokenResult.expiresAt) dbAccount.tokenExpiresAt = tokenResult.expiresAt;
        await dbAccount.save();
      }
      transporter = nodemailer.createTransport({
        host: "smtp.office365.com",
        port: 587,
        secure: false,
        auth: {
          type: "OAuth2",
          user: from,
          accessToken: tokenResult.accessToken,
        },
      } as any);
    } else {
      // Gmail / IMAP app password SMTP — use port 587 (STARTTLS) for Railway compatibility
      const isOutlook = dbAccount.provider === "outlook";
      transporter = nodemailer.createTransport({
        host: isOutlook ? "smtp.office365.com" : "smtp.gmail.com",
        port: 587,
        secure: false,
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
