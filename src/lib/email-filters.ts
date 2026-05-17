const AUTOMATED_ADDRESS_PATTERNS = [
  /^no.?reply@/i, /^noreply@/i, /^do.?not.?reply@/i,
  /^mailer@/i, /^bounce[+-]/i, /^notifications?@/i,
  /^alerts?@/i, /^newsletter@/i, /^updates?@/i,
  /^orders?@/i, /^support@/i, /^billing@/i,
  /^info@accounts\./i, /@accounts\.google\.com$/i,
  /@notifications\./i,
  /@mail\.(linkedin|facebook|twitter|instagram|tiktok|amazon|ebay|paypal)\.com$/i,
  /^hello@send\./i, /^hello@e\./i, /^hello@email\./i,
  /^hello@newsletters?\./i, /^hello@promo\./i,
];

// Domains that send promotional/retail emails — not freight
const BLOCKED_SENDER_DOMAINS = [
  "gap.com", "gapfactory.com", "oldnavy.com", "bananarepublic.com",
  "waterdrop.com", "amazon.com", "ebay.com", "etsy.com",
  "shopify.com", "aliexpress.com", "alibaba.com",
  "netflix.com", "spotify.com", "apple.com", "google.com",
  "facebook.com", "instagram.com", "twitter.com", "linkedin.com",
  "tiktok.com", "youtube.com", "reddit.com",
  "uber.com", "lyft.com", "doordash.com", "grubhub.com",
  "walmart.com", "target.com", "bestbuy.com", "costco.com",
  "nike.com", "adidas.com", "zara.com", "hm.com",
  "sephora.com", "ulta.com", "macys.com", "nordstrom.com",
  "airbnb.com", "booking.com", "expedia.com", "hotels.com",
  "slack.com", "zoom.us", "dropbox.com", "notion.so",
  "mailchimp.com", "sendgrid.net", "constantcontact.com",
  "hubspot.com", "salesforce.com", "zendesk.com",
  "stripe.com", "paypal.com", "squarespace.com", "wix.com",
  "canva.com", "figma.com", "github.com", "gitlab.com",
  "medium.com", "substack.com",
];

const AUTOMATED_SUBJECT_PATTERNS = [
  /security alert/i, /verify your email/i,
  /confirm your (email|account|subscription)/i,
  /unsubscribe/i, /newsletter/i,
  /your (order|receipt|invoice) (has been|was)/i,
  /password reset/i, /\[automated\]/i,
  /cupcake|pastry|bakery|cake order|food order/i,
  /appointment (confirmed|reminder|booked)/i,
  /booking confirmation/i,
  /thank you for your (order|purchase)/i,
  /% off/i, /clearance/i, /flash sale/i, /limited time/i,
  /free shipping.*(?:ends|today|last chance)/i,
  /use your (?:email )?exclusives?/i,
  /extra \d+% off/i, /don't miss/i, /your bonus/i,
  /shop now/i, /shop the/i, /new arrivals/i,
  /mother'?s day/i, /father'?s day/i, /valentine/i, /black friday/i,
  /gift (?:ideas|guide|card)/i,
];

export function isAutomatedEmail(email: {
  fromEmail: string;
  subject: string;
  headers?: Record<string, string>;
}): boolean {
  if (email.headers?.["list-unsubscribe"]) return true;
  if (AUTOMATED_ADDRESS_PATTERNS.some((p) => p.test(email.fromEmail))) return true;
  if (AUTOMATED_SUBJECT_PATTERNS.some((p) => p.test(email.subject))) return true;

  // Block known retail/promo sender domains
  const domain = email.fromEmail.split("@")[1]?.toLowerCase() || "";
  // Check exact domain and parent domain (e.g. send.waterdrop.com → waterdrop.com)
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const checkDomain = parts.slice(i).join(".");
    if (BLOCKED_SENDER_DOMAINS.includes(checkDomain)) return true;
  }

  return false;
}

export function normaliseMessageId(raw: string | undefined | null): string | null {
  if (!raw) return null;
  return raw.trim().replace(/^<|>$/g, "");
}

/** Quick check: does this email look like it could be freight/shipping related? */
export function looksLikeFreight(email: { subject: string; body: string }): boolean {
  const text = `${email.subject} ${email.body}`.toLowerCase();
  const freightKeywords = [
    "rfq", "rqf", "request for quote", "freight", "shipment", "shipping",
    "container", "20ft", "40ft", "40hc", "20gp", "40gp", "20'", "40'",
    "fcl", "lcl", "fob", "cif", "exw", "cfr", "dap", "ddp",
    "pol", "pod", "port of loading", "port of discharge", "port of destination",
    "bill of lading", "b/l", "bl", "bol",
    "commodity", "cargo", "consignment", "consignee",
    "ocean freight", "sea freight", "air freight", "airfreight",
    "haulage", "trucking", "drayage",
    "customs", "clearance", "import", "export",
    "hs code", "hscode", "tariff",
    "cbm", "cubic meter", "tonnage", "metric ton",
    "vessel", "sailing", "eta", "etd",
    "incoterm", "dangerous goods", "dg class", "hazmat",
    "packing list", "commercial invoice",
    "apapa", "tin can", "onne", "lagos port", "ngapp", "ngtcn",
    "door to door", "door-to-door", "port to port", "port-to-port",
    "rate", "quotation", "quote", "pricing", "tariff",
    "stuffing", "destuffing", "demurrage", "detention",
    "thc", "terminal handling",
    "booking", "book a", "need to ship", "want to ship", "looking to ship",
    "shipping line", "carrier", "msc", "maersk", "cosco", "hapag", "cma cgm", "evergreen",
    "nigeria", "china", "india", "turkey", "europe", "dubai", "rotterdam", "shanghai",
  ];

  return freightKeywords.some((kw) => text.includes(kw));
}
