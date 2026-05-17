// ── Automated-sender filter ───────────────────────────────────────────────────
// Returns true if the email should be skipped (not an RFQ candidate)

const AUTOMATED_ADDRESS_PATTERNS = [
  /^no.?reply@/i,
  /^noreply@/i,
  /^do.?not.?reply@/i,
  /^mailer@/i,
  /^bounce[+-]/i,
  /^notifications?@/i,
  /^alerts?@/i,
  /^newsletter@/i,
  /^updates?@/i,
  /^orders?@/i,
  /^support@/i,
  /^billing@/i,
  /^info@accounts\./i,
  /@accounts\.google\.com$/i,
  /@notifications\./i,
  /@mail\.(linkedin|facebook|twitter|instagram|tiktok|amazon|ebay|paypal)\.com$/i,
];

const AUTOMATED_SUBJECT_PATTERNS = [
  /security alert/i,
  /verify your email/i,
  /confirm your (email|account|subscription)/i,
  /unsubscribe/i,
  /newsletter/i,
  /your (order|receipt|invoice) (has been|was)/i,
  /password reset/i,
  /\[automated\]/i,
  /cupcake|pastry|bakery|cake order|food order/i,
  /appointment (confirmed|reminder|booked)/i,
  /booking confirmation/i,
  /thank you for your (order|purchase)/i,
];

// Sender domains that are never freight-related
const BLOCKED_SENDER_DOMAINS = [
  "gapfactory.com", "gap.com", "oldnavy.com", "bananarepublic.com",
  "waterdrop.com", "poshmark.com", "quip.com", "budgettravel.com",
  "nba.com", "warriors.com",
  "amazon.com", "ebay.com", "etsy.com", "shopify.com",
  "aliexpress.com", "netflix.com", "spotify.com", "apple.com",
  "facebook.com", "instagram.com", "twitter.com", "linkedin.com",
  "tiktok.com", "youtube.com", "reddit.com", "medium.com",
  "uber.com", "lyft.com", "doordash.com", "grubhub.com",
  "walmart.com", "target.com", "bestbuy.com", "costco.com",
  "nike.com", "adidas.com", "zara.com", "hm.com",
  "sephora.com", "macys.com", "nordstrom.com",
  "airbnb.com", "booking.com", "expedia.com",
  "slack.com", "zoom.us", "dropbox.com", "notion.so",
  "mailchimp.com", "sendgrid.net", "hubspot.com",
  "stripe.com", "paypal.com", "squarespace.com", "wix.com",
  "canva.com", "figma.com", "github.com", "substack.com",
  "bordfrancais.com", "bordier.com",
];

export function isAutomatedEmail(email: {
  fromEmail: string;
  subject: string;
  hasListUnsubscribe?: boolean;
}): boolean {
  if (email.hasListUnsubscribe) return true;
  if (AUTOMATED_ADDRESS_PATTERNS.some((p) => p.test(email.fromEmail))) return true;
  if (AUTOMATED_SUBJECT_PATTERNS.some((p) => p.test(email.subject))) return true;

  // Block known non-freight sender domains (check parent domains too)
  const domain = email.fromEmail.split("@")[1]?.toLowerCase() || "";
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (BLOCKED_SENDER_DOMAINS.includes(parts.slice(i).join("."))) return true;
  }

  return false;
}

export function normaliseMessageId(raw: string | undefined | null): string | null {
  if (!raw) return null;
  return raw.trim().replace(/^<|>$/g, "");
}
