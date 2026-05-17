const AUTOMATED_ADDRESS_PATTERNS = [
  /^no.?reply@/i, /^noreply@/i, /^do.?not.?reply@/i,
  /^mailer@/i, /^bounce[+-]/i, /^notifications?@/i,
  /^alerts?@/i, /^newsletter@/i, /^updates?@/i,
  /^orders?@/i, /^support@/i, /^billing@/i,
  /^info@accounts\./i, /@accounts\.google\.com$/i,
  /@notifications\./i,
  /@mail\.(linkedin|facebook|twitter|instagram|tiktok|amazon|ebay|paypal)\.com$/i,
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
];

export function isAutomatedEmail(email: {
  fromEmail: string;
  subject: string;
  headers?: Record<string, string>;
}): boolean {
  if (email.headers?.["list-unsubscribe"]) return true;
  if (AUTOMATED_ADDRESS_PATTERNS.some((p) => p.test(email.fromEmail))) return true;
  if (AUTOMATED_SUBJECT_PATTERNS.some((p) => p.test(email.subject))) return true;
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
