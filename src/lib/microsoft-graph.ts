import axios, { AxiosInstance } from "axios";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// Shipping keywords to filter emails (same as Gmail sync)
const SHIPPING_KEYWORDS = [
  "shipment", "freight", "shipping", "cargo", "container",
  "FCL", "LCL", "RFQ", "quotation", "rate request",
  "bill of lading", "B/L", "POL", "POD", "transit",
  "export", "import", "customs", "logistics",
];

export interface GraphMessage {
  id: string;
  subject: string;
  from: string;
  fromEmail: string;
  bodyText: string;
  sentAt: Date;
  receivedAt: Date;
  cc?: string;
  conversationId: string;
  internetMessageId?: string;
}

export interface GraphThread {
  conversationId: string;
  subject: string;
  messages: GraphMessage[];
  lastMessageAt: Date;
}

function getClient(accessToken: string): AxiosInstance {
  return axios.create({
    baseURL: GRAPH_BASE,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

/** Strip HTML tags to get plain text */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Fetch shipping-related emails from a mailbox via Graph API.
 * For shared mailboxes, pass the shared email as `mailbox`.
 * For personal mailboxes, pass undefined or the user's own email.
 */
export async function fetchShippingEmails(
  accessToken: string,
  opts: {
    mailbox?: string; // shared mailbox email, or undefined for /me
    maxMessages?: number;
    daysBack?: number;
  } = {}
): Promise<GraphThread[]> {
  const client = getClient(accessToken);
  const maxMessages = opts.maxMessages || 200;
  const daysBack = opts.daysBack || 60;

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - daysBack);
  const sinceDateStr = sinceDate.toISOString();

  // Build search query with shipping keywords
  const searchTerms = SHIPPING_KEYWORDS.map(k => `"${k}"`).join(" OR ");

  // Use /me for personal, /users/{email} for shared
  const basePath = opts.mailbox ? `/users/${opts.mailbox}` : "/me";

  const allMessages: GraphMessage[] = [];
  let nextLink: string | null = null;

  // First request — search for shipping emails
  try {
    const params: Record<string, string> = {
      $search: searchTerms,
      $select: "id,subject,from,body,sentDateTime,receivedDateTime,ccRecipients,conversationId,internetMessageHeaders",
      $top: String(Math.min(maxMessages, 50)),
      $orderby: "receivedDateTime desc",
      $filter: `receivedDateTime ge ${sinceDateStr}`,
    };

    // Note: $search and $filter can't always be combined in Graph API
    // Use $search alone for broader results, then filter in code
    delete params.$filter;

    let url = `${basePath}/messages?${new URLSearchParams(params)}`;
    let fetched = 0;

    while (url && fetched < maxMessages) {
      const { data } = await client.get(url);
      const messages = data.value || [];

      for (const msg of messages) {
        const receivedAt = new Date(msg.receivedDateTime);
        if (receivedAt < sinceDate) continue; // Skip old messages

        const bodyText = msg.body?.contentType === "text"
          ? msg.body.content
          : stripHtml(msg.body?.content || "");

        const cc = (msg.ccRecipients || [])
          .map((r: any) => r.emailAddress?.address)
          .filter(Boolean)
          .join(", ");

        allMessages.push({
          id: msg.id,
          subject: msg.subject || "(no subject)",
          from: msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || "Unknown",
          fromEmail: msg.from?.emailAddress?.address || "",
          bodyText,
          sentAt: new Date(msg.sentDateTime),
          receivedAt,
          cc: cc || undefined,
          conversationId: msg.conversationId || msg.id,
          internetMessageId: msg.internetMessageHeaders?.find(
            (h: any) => h.name.toLowerCase() === "message-id"
          )?.value,
        });
        fetched++;
      }

      nextLink = data["@odata.nextLink"] || null;
      url = nextLink || "";
    }
  } catch (err: any) {
    const status = err.response?.status;
    const msg = err.response?.data?.error?.message || err.message;
    console.error(`[GRAPH] Failed to fetch messages from ${basePath}: ${status} — ${msg}`);
    throw new Error(`Graph API error (${status}): ${msg}`);
  }

  // Group messages by conversationId into threads
  const threadMap = new Map<string, GraphMessage[]>();
  for (const msg of allMessages) {
    const key = msg.conversationId;
    if (!threadMap.has(key)) threadMap.set(key, []);
    threadMap.get(key)!.push(msg);
  }

  // Convert to threads sorted by most recent
  const threads: GraphThread[] = [];
  for (const [convId, msgs] of threadMap) {
    msgs.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
    threads.push({
      conversationId: convId,
      subject: msgs[0].subject,
      messages: msgs,
      lastMessageAt: msgs[msgs.length - 1].receivedAt,
    });
  }

  threads.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());

  console.log(`[GRAPH] Fetched ${allMessages.length} messages in ${threads.length} threads from ${opts.mailbox || "personal"}`);
  return threads;
}

/**
 * Delta sync — fetch only new/changed messages since last sync.
 * Returns threads and a new deltaLink to store.
 */
export async function deltaSyncOutlook(
  accessToken: string,
  deltaLink: string,
  opts: { mailbox?: string } = {}
): Promise<{ threads: GraphThread[]; newDeltaLink: string }> {
  const client = getClient(accessToken);
  const allMessages: GraphMessage[] = [];
  let url = deltaLink;
  let newDeltaLink = deltaLink;

  while (url) {
    const { data } = await client.get(url);
    const messages = data.value || [];

    for (const msg of messages) {
      // Skip removed items
      if (msg["@removed"]) continue;
      if (!msg.from) continue;

      const bodyText = msg.body?.contentType === "text"
        ? msg.body.content
        : stripHtml(msg.body?.content || "");

      allMessages.push({
        id: msg.id,
        subject: msg.subject || "(no subject)",
        from: msg.from?.emailAddress?.name || "",
        fromEmail: msg.from?.emailAddress?.address || "",
        bodyText,
        sentAt: new Date(msg.sentDateTime || msg.receivedDateTime),
        receivedAt: new Date(msg.receivedDateTime),
        conversationId: msg.conversationId || msg.id,
      });
    }

    if (data["@odata.nextLink"]) {
      url = data["@odata.nextLink"];
    } else {
      newDeltaLink = data["@odata.deltaLink"] || deltaLink;
      url = "";
    }
  }

  // Group into threads
  const threadMap = new Map<string, GraphMessage[]>();
  for (const msg of allMessages) {
    if (!threadMap.has(msg.conversationId)) threadMap.set(msg.conversationId, []);
    threadMap.get(msg.conversationId)!.push(msg);
  }

  const threads: GraphThread[] = [];
  for (const [convId, msgs] of threadMap) {
    msgs.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
    threads.push({
      conversationId: convId,
      subject: msgs[0].subject,
      messages: msgs,
      lastMessageAt: msgs[msgs.length - 1].receivedAt,
    });
  }

  console.log(`[GRAPH] Delta sync: ${allMessages.length} new messages in ${threads.length} threads`);
  return { threads, newDeltaLink };
}

/**
 * Get initial delta link for a mailbox folder (for first-time delta setup).
 */
export async function getInitialDeltaLink(
  accessToken: string,
  opts: { mailbox?: string } = {}
): Promise<string> {
  const client = getClient(accessToken);
  const basePath = opts.mailbox ? `/users/${opts.mailbox}` : "/me";

  // Request delta with $select to start tracking
  let url = `${basePath}/mailFolders/inbox/messages/delta?$select=id,subject,from,body,sentDateTime,receivedDateTime,conversationId,ccRecipients`;
  let deltaLink = "";

  // Page through all results to get the deltaLink at the end
  while (url) {
    const { data } = await client.get(url);
    if (data["@odata.nextLink"]) {
      url = data["@odata.nextLink"];
    } else {
      deltaLink = data["@odata.deltaLink"] || "";
      url = "";
    }
  }

  return deltaLink;
}
