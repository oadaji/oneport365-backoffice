import { getValidToken } from "./microsoft-oauth";
import { EmailAccount } from "../models/email-account";

/** Get access token and persist refreshed tokens to DB */
async function getAndPersistToken(account: any): Promise<string> {
  const result = await getValidToken(account);
  if (result.refreshed && account._id) {
    await EmailAccount.findByIdAndUpdate(account._id, {
      accessToken: result.accessToken,
      ...(result.refreshToken && { refreshToken: result.refreshToken }),
      ...(result.expiresAt && { tokenExpiresAt: result.expiresAt }),
    });
  }
  return result.accessToken;
}

// ── Outlook shipping search (KQL) — every Graph call MUST include this ──
export const OUTLOOK_SHIPPING_SEARCH = [
  // subject signals
  "(subject:RFQ OR subject:quote OR subject:quotation OR subject:freight OR subject:shipment OR subject:shipping OR subject:container OR subject:FCL OR subject:LCL OR subject:\"bill of lading\" OR subject:BOL OR subject:booking OR subject:rates OR subject:ETA OR subject:ETD OR subject:\"ex works\" OR subject:EXW OR subject:CIF OR subject:FOB OR subject:DAP)",
  // body signals
  "OR (body:\"20ft\" OR body:\"40ft\" OR body:\"40HC\" OR body:POL OR body:POD OR body:THC OR body:demurrage OR body:NGAPP OR body:Apapa OR body:\"Tin Can\" OR body:LOCODE)",
  // carrier / forwarder senders
  "OR (from:maersk.com OR from:msc.com OR from:cma-cgm.com OR from:hapag-lloyd.com OR from:one-line.com OR from:pilship.com OR from:oneport365.com OR from:cosco-usa.com OR from:evergreen-line.com)",
].join(" ");

export interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  toRecipients: Array<{ emailAddress: { name: string; address: string } }>;
  ccRecipients?: Array<{ emailAddress: { name: string; address: string } }>;
  receivedDateTime: string;
  bodyPreview: string;
  body?: { contentType: string; content: string };
  hasAttachments: boolean;
}

function outlookDateFilter(daysBack: number): string {
  const cutoff = new Date(Date.now() - daysBack * 86400_000).toISOString();
  return `receivedDateTime ge ${cutoff}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function graphFetch(accessToken: string, url: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.body-content-type="text"',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

/**
 * Fetch shipping-related emails from Outlook via Microsoft Graph API.
 * Uses $search (KQL) for keyword filtering + $filter for date range.
 * Never fetches from the root mailbox — always /me/mailFolders/inbox/messages.
 */
export async function fetchOutlookShippingEmails(
  account: any,
  opts: { maxMessages?: number; sinceDate?: Date } = {}
): Promise<GraphMessage[]> {
  const maxMessages = opts.maxMessages || 100;
  const token = await getAndPersistToken(account);

  // Determine date filter
  let dateFilter: string;
  if (opts.sinceDate) {
    dateFilter = `receivedDateTime ge ${opts.sinceDate.toISOString()}`;
  } else if (account.lastSyncedAt) {
    // Subsequent sync — since last sync with 1hr buffer
    const since = new Date(new Date(account.lastSyncedAt).getTime() - 3600_000);
    dateFilter = `receivedDateTime ge ${since.toISOString()}`;
  } else {
    // First sync — 30 days back
    dateFilter = outlookDateFilter(30);
  }

  const messages: GraphMessage[] = [];
  const select = "id,conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,hasAttachments,body";

  // $search and $orderby are mutually exclusive in Graph — that's fine, relevance order is OK
  let url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$search="${encodeURIComponent(OUTLOOK_SHIPPING_SEARCH)}"&$filter=${encodeURIComponent(dateFilter)}&$top=50&$select=${select}`;

  while (messages.length < maxMessages && url) {
    try {
      const data = await graphFetch(token, url);
      const batch: GraphMessage[] = data.value || [];

      if (batch.length === 0) break;
      messages.push(...batch);

      // Pagination
      url = data["@odata.nextLink"] || "";
    } catch (err: any) {
      // $search + $filter might fail on some tenants — fall back to $filter only
      if (err.message.includes("400") && url.includes("$search")) {
        console.warn("Graph $search+$filter failed, falling back to $filter only");
        url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=${encodeURIComponent(dateFilter)}&$top=50&$select=${select}&$orderby=receivedDateTime desc`;
        continue;
      }
      throw err;
    }
  }

  return messages.slice(0, maxMessages);
}

/**
 * Delta sync using Graph delta query.
 * Returns new messages since the last deltaLink cursor.
 */
export async function deltaSync(
  account: any
): Promise<{ messages: GraphMessage[]; newCursor: string }> {
  const token = await getAndPersistToken(account);
  const messages: GraphMessage[] = [];

  let url: string;
  if (account.cursor) {
    // Use existing deltaLink
    url = account.cursor;
  } else {
    // First delta — get initial deltaLink
    url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$select=id,conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,hasAttachments,body&$top=50`;
  }

  let newCursor = account.cursor || "";

  while (url) {
    const data = await graphFetch(token, url);
    const batch: GraphMessage[] = data.value || [];
    messages.push(...batch);

    if (data["@odata.nextLink"]) {
      url = data["@odata.nextLink"];
    } else if (data["@odata.deltaLink"]) {
      newCursor = data["@odata.deltaLink"];
      url = "";
    } else {
      url = "";
    }
  }

  return { messages, newCursor };
}

/**
 * Get full message body for a specific message.
 */
export async function getMessageBody(
  account: any,
  messageId: string
): Promise<string> {
  const token = await getAndPersistToken(account);
  const data = await graphFetch(
    token,
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=body`
  );

  if (data.body?.contentType === "text") {
    return data.body.content || "";
  }
  // HTML → strip tags
  return stripHtml(data.body?.content || "");
}
