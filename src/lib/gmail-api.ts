import { google, gmail_v1 } from "googleapis";

const clientId = process.env.GOOGLE_CLIENT_ID || "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const redirectUri =
  process.env.GOOGLE_REDIRECT_URI ||
  "http://localhost:5001/api/auth/google/callback";

// ── Frozen shipping query — every Gmail API call MUST include this ──
export const GMAIL_SHIPPING_QUERY = [
  // subject signals
  'subject:(RFQ OR quote OR quotation OR freight OR shipment OR shipping OR container OR FCL OR LCL OR "bill of lading" OR BOL OR booking OR rates OR ETA OR ETD OR "ex works" OR EXW OR CIF OR FOB OR DAP)',
  // body signals (Gmail full-text)
  'OR ("20ft" OR "40ft" OR "40HC" OR "POL" OR "POD" OR "THC" OR demurrage OR NGAPP OR Apapa OR "Tin Can" OR LOCODE)',
  // known carrier / forwarder senders
  "OR from:(maersk.com OR msc.com OR cma-cgm.com OR hapag-lloyd.com OR one-line.com OR pilship.com OR oneport365.com OR cosco-usa.com OR evergreen-line.com)",
  // exclude noise
  "-from:(noreply OR no-reply OR newsletter OR notifications OR linkedin.com)",
  "-category:promotions",
  "-category:social",
  "newer_than:60d",
].join(" ");

function getOAuth2Client() {
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function getAuthedClient(refreshToken: string) {
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

/** Generate Google OAuth consent URL */
export function getGoogleAuthUrl(state?: string): string {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    state: state || "",
  });
}

/** Exchange authorization code for tokens */
export async function exchangeGoogleCode(code: string): Promise<{
  refreshToken: string;
  accessToken: string;
  email: string;
  name: string;
}> {
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  // Get user profile
  const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
  const { data: profile } = await oauth2Api.userinfo.get();

  return {
    refreshToken: tokens.refresh_token || "",
    accessToken: tokens.access_token || "",
    email: (profile.email || "").toLowerCase(),
    name: profile.name || profile.email || "",
  };
}

export interface GmailThread {
  threadId: string;
  subject: string;
  from: string;
  fromEmail: string;
  lastMessageAt: Date;
  messages: GmailMessage[];
}

export interface GmailMessage {
  messageId: string;
  threadId: string;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  sentAt: Date;
  bodyText: string;
  inReplyTo?: string;
  cc?: string;
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  if (!headers) return "";
  const h = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return h?.value || "";
}

function parseFrom(fromStr: string): { name: string; email: string } {
  const match = fromStr.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2].toLowerCase() };
  return { name: fromStr, email: fromStr.toLowerCase() };
}

function decodeBody(payload: gmail_v1.Schema$MessagePart): string {
  // Try plain text first
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  // Check parts recursively
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf-8");
      }
    }
    // Fallback to HTML if no plain text
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = Buffer.from(part.body.data, "base64url").toString("utf-8");
        return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      }
    }
    // Nested multipart
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = decodeBody(part);
        if (nested) return nested;
      }
    }
  }

  return "";
}

/**
 * Initial sync: fetch shipping-related threads from Gmail API.
 * Every call uses GMAIL_SHIPPING_QUERY — never scans full inbox.
 */
export async function fetchShippingThreads(
  refreshToken: string,
  opts: { maxThreads?: number } = {}
): Promise<GmailThread[]> {
  const maxThreads = opts.maxThreads || 100;
  const auth = getAuthedClient(refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  const threads: GmailThread[] = [];
  let pageToken: string | undefined;

  // Paginate thread list — always with shipping query
  while (threads.length < maxThreads) {
    const listRes = await gmail.users.threads.list({
      userId: "me",
      q: GMAIL_SHIPPING_QUERY,
      maxResults: Math.min(50, maxThreads - threads.length),
      pageToken,
    });

    const threadIds = listRes.data.threads || [];
    if (threadIds.length === 0) break;

    // Fetch full thread data
    for (const t of threadIds) {
      if (!t.id) continue;
      try {
        const threadRes = await gmail.users.threads.get({
          userId: "me",
          id: t.id,
          format: "full",
        });

        const messages: GmailMessage[] = [];
        let subject = "";
        let lastDate = new Date(0);
        let threadFrom = "";
        let threadFromEmail = "";

        for (const msg of threadRes.data.messages || []) {
          const headers = msg.payload?.headers;
          const fromStr = getHeader(headers, "From");
          const parsed = parseFrom(fromStr);
          const sentAt = new Date(
            parseInt(msg.internalDate || "0", 10)
          );
          const msgSubject = getHeader(headers, "Subject");

          if (!subject) subject = msgSubject;
          if (sentAt > lastDate) {
            lastDate = sentAt;
          }
          if (!threadFrom) {
            threadFrom = parsed.name;
            threadFromEmail = parsed.email;
          }

          messages.push({
            messageId: msg.id || "",
            threadId: t.id,
            from: parsed.name,
            fromEmail: parsed.email,
            to: getHeader(headers, "To"),
            subject: msgSubject,
            sentAt,
            bodyText: decodeBody(msg.payload || {}),
            inReplyTo: getHeader(headers, "In-Reply-To") || undefined,
            cc: getHeader(headers, "Cc") || undefined,
          });
        }

        threads.push({
          threadId: t.id,
          subject,
          from: threadFrom,
          fromEmail: threadFromEmail,
          lastMessageAt: lastDate,
          messages,
        });
      } catch (err) {
        console.error(`Failed to fetch thread ${t.id}:`, err);
      }
    }

    pageToken = listRes.data.nextPageToken || undefined;
    if (!pageToken) break;
  }

  return threads;
}

/**
 * Incremental sync using Gmail history API.
 * Returns new threads since the last historyId.
 */
export async function deltaSyncGmail(
  refreshToken: string,
  lastHistoryId: string
): Promise<{ threads: GmailThread[]; newHistoryId: string }> {
  const auth = getAuthedClient(refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  const threadIds = new Set<string>();

  try {
    let pageToken: string | undefined;
    do {
      const historyRes = await gmail.users.history.list({
        userId: "me",
        startHistoryId: lastHistoryId,
        historyTypes: ["messageAdded"],
        pageToken,
      });

      for (const h of historyRes.data.history || []) {
        for (const msg of h.messagesAdded || []) {
          if (msg.message?.threadId) {
            threadIds.add(msg.message.threadId);
          }
        }
      }

      pageToken = historyRes.data.nextPageToken || undefined;
    } while (pageToken);

    // Get current historyId
    const profile = await gmail.users.getProfile({ userId: "me" });
    const newHistoryId = profile.data.historyId || lastHistoryId;

    // Fetch full threads
    const threads: GmailThread[] = [];
    for (const tid of threadIds) {
      try {
        const threadRes = await gmail.users.threads.get({
          userId: "me",
          id: tid,
          format: "full",
        });

        const messages: GmailMessage[] = [];
        let subject = "";
        let lastDate = new Date(0);
        let threadFrom = "";
        let threadFromEmail = "";

        for (const msg of threadRes.data.messages || []) {
          const headers = msg.payload?.headers;
          const fromStr = getHeader(headers, "From");
          const parsed = parseFrom(fromStr);
          const sentAt = new Date(parseInt(msg.internalDate || "0", 10));
          const msgSubject = getHeader(headers, "Subject");

          if (!subject) subject = msgSubject;
          if (sentAt > lastDate) lastDate = sentAt;
          if (!threadFrom) {
            threadFrom = parsed.name;
            threadFromEmail = parsed.email;
          }

          messages.push({
            messageId: msg.id || "",
            threadId: tid,
            from: parsed.name,
            fromEmail: parsed.email,
            to: getHeader(headers, "To"),
            subject: msgSubject,
            sentAt,
            bodyText: decodeBody(msg.payload || {}),
            inReplyTo: getHeader(headers, "In-Reply-To") || undefined,
            cc: getHeader(headers, "Cc") || undefined,
          });
        }

        threads.push({
          threadId: tid,
          subject,
          from: threadFrom,
          fromEmail: threadFromEmail,
          lastMessageAt: lastDate,
          messages,
        });
      } catch (err) {
        console.error(`Failed to fetch thread ${tid}:`, err);
      }
    }

    return { threads, newHistoryId };
  } catch (err: any) {
    // If historyId is too old, do a full resync
    if (err.code === 404) {
      console.warn("History expired, performing full resync");
      const threads = await fetchShippingThreads(refreshToken, { maxThreads: 100 });
      const profile = await gmail.users.getProfile({ userId: "me" });
      return { threads, newHistoryId: profile.data.historyId || lastHistoryId };
    }
    throw err;
  }
}

/** Get current historyId for initial cursor */
export async function getGmailHistoryId(refreshToken: string): Promise<string> {
  const auth = getAuthedClient(refreshToken);
  const gmail = google.gmail({ version: "v1", auth });
  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data.historyId || "";
}
