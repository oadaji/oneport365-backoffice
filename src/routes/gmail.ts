// @ts-nocheck
import { Router, Request, Response } from "express";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { Readable } from "stream";
import nodemailer from "nodemailer";
import { Email } from "../models/email";
import { EmailAccount } from "../models/email-account";
import { Rfq } from "../models/rfq";
import { isAutomatedEmail, normaliseMessageId, looksLikeFreight } from "../lib/email-filters";
import { extractWithClaude, preClassifyEmail } from "../lib/ai-extract";
import { resolveContact } from "../lib/resolve-contact";
import { getValidToken, refreshAccessToken } from "../lib/microsoft-oauth";
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
      const client = createImapClient(account);

      client.on("error", () => {});
      await client.connect();

      const lock = await client.getMailboxLock("INBOX");
      try {
        // IMAP SEARCH — server-side filter for shipping emails only
        // Search for emails from the last 60 days with shipping-related keywords
        const sinceDate = new Date(Date.now() - 60 * 86400_000);
        const sinceStr = sinceDate.toISOString().slice(0, 10).replace(/-/g, "-");

        // IMAP OR search for shipping keywords in subject
        const shippingUids = await client.search({
          since: sinceDate,
          or: [
            { subject: "RFQ" },
            { subject: "quote" },
            { subject: "freight" },
            { subject: "shipment" },
            { subject: "shipping" },
            { subject: "container" },
            { subject: "FCL" },
            { subject: "LCL" },
            { subject: "booking" },
            { subject: "rates" },
            { subject: "EXW" },
            { subject: "FOB" },
            { subject: "CIF" },
            { subject: "bill of lading" },
            { subject: "BOL" },
            { subject: "quotation" },
            { subject: "ETA" },
            { subject: "ETD" },
            { subject: "DAP" },
          ],
        }, { uid: true });

        if (!shippingUids || shippingUids.length === 0) continue;

        // Cap at maxResults most recent
        const uidsToFetch = shippingUids.slice(-maxResults);
        const uidRange = uidsToFetch.join(",");

        for await (const msg of client.fetch(uidRange, { envelope: true, source: true, internalDate: true }, { uid: true })) {
          try {
            const source = msg.source;
            if (!source) continue;
            const parsed = await simpleParser(Readable.from(source));

            const fromAddr = parsed.from?.value?.[0];
            if (!fromAddr?.address) continue;

            const fromEmail = fromAddr.address.toLowerCase();
            const fromName = fromAddr.name || fromEmail;
            const subject = parsed.subject || "(no subject)";
            const body = parsed.text || parsed.html || "";
            const messageId = normaliseMessageId(parsed.messageId);
            const inReplyTo = normaliseMessageId(parsed.inReplyTo as string);
            const cc = parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).map((c) => c.text).join(", ") : null;

            // Build unique UID
            const uid = messageId ? `mid:${messageId}` : `${account.email}:${msg.seq}`;

            // Skip automated emails
            if (isAutomatedEmail({ fromEmail, subject, headers: parsed.headers as any })) {
              totalSkipped++;
              continue;
            }

            // Skip non-freight emails before any DB writes
            if (!looksLikeFreight({ subject, body: typeof body === "string" ? body : "" })) {
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

                  if (extraction.shipments.length > 0) {
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

                  if (extraction.shipments.length > 0) {
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

            // Pre-classify before Claude
            const preClass = preClassifyEmail({ fromName, fromEmail, subject, body: typeof body === "string" ? body : "" });
            if (preClass && preClass !== "customer-rfq" && preClass !== "internal-rfq") {
              totalSkipped++;
              continue;
            }

            // Claude extraction
            const extraction = await extractWithClaude(
              { fromName, fromEmail, subject, body: typeof body === "string" ? body : "" },
              "customer-rfq"
            );

            const resolvedType = extraction.detectedEmailType || "customer-rfq";
            if (resolvedType !== "customer-rfq" && resolvedType !== "internal-rfq") {
              totalSkipped++;
              continue;
            }

            // Check freight match — only proceed if POL or POD found
            const hasRoute = extraction.shipments.some((s) =>
              s.fields.some((f) => (f.k === "POL" || f.k === "POD") && f.ok)
            );
            if (!hasRoute) {
              totalSkipped++;
              continue;
            }

            // Confirmed freight RFQ — now create CRM contact and email record
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
              await Rfq.create({
                emailId: emailDoc._id,
                ref: generateRef(),
                emailType: resolvedType,
                status: s.status,
                fields: s.fields,
                missingFields: s.missing,
                followUpDraft: isGroup ? (idx === 0 ? extraction.combinedDraft : null) : (extraction.combinedDraft || s.draft),
                groupId,
                groupIndex: isGroup ? idx + 1 : undefined,
                groupTotal: isGroup ? extraction.shipments.length : undefined,
                sourceMessageId: messageId || undefined,
                companyId: crm.companyId || undefined,
                contactId: crm.contactId,
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
      from: fromEmail,
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
