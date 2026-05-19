/**
 * Stage 2 Local Classifier — scores emails 0-1 for shipping relevance.
 * Runs AFTER IMAP/Graph search (Stage 1) and automated filter.
 * Provider-agnostic — works on any email content.
 *
 * Score >= 0.6 → shippingRelevant: true, surface in inbox
 * 0.4 <= score < 0.6 → borderline, let Claude classify
 * Score < 0.4 → drop, never shown
 */

const FREIGHT_KEYWORDS_HIGH = [
  "rfq", "request for quote", "freight rate", "shipping rate", "ocean freight",
  "sea freight", "air freight", "fcl", "lcl", "container", "20ft", "40ft", "40hc",
  "bill of lading", "bol", "b/l", "port of loading", "port of discharge",
  "pol", "pod", "locode", "incoterm", "exw", "fob", "cif", "cfr", "dap", "ddp",
  "customs clearance", "import duty", "export documentation",
  "dangerous goods", "dg class", "hazmat", "reefer",
  "demurrage", "detention", "thc", "terminal handling",
  "haulage", "trucking", "drayage",
  "commodity", "consignment", "consignee", "shipper",
  "packing list", "commercial invoice", "certificate of origin",
];

const FREIGHT_KEYWORDS_MED = [
  "shipment", "shipping", "quote", "quotation", "rate", "pricing",
  "booking", "vessel", "sailing", "eta", "etd", "transit time",
  "cargo", "goods", "tonnage", "cbm", "cubic meter", "metric ton",
  "apapa", "tin can", "onne", "lagos port", "mombasa", "tema",
  "ngapp", "ngtcn", "ngone",
  "import", "export", "cross-trade",
];

const CARRIER_DOMAINS = [
  "maersk.com", "msc.com", "cma-cgm.com", "hapag-lloyd.com",
  "one-line.com", "pilship.com", "cosco-usa.com", "evergreen-line.com",
  "yangming.com", "zim.com", "hmm21.com", "wanhai.com",
  "oneport365.com",
];

const NOISE_DOMAINS = [
  "gapfactory.com", "gap.com", "waterdrop.com", "poshmark.com",
  "amazon.com", "ebay.com", "netflix.com", "spotify.com",
  "linkedin.com", "facebook.com", "twitter.com", "instagram.com",
  "walmart.com", "target.com", "nike.com", "adidas.com",
  "airbnb.com", "booking.com", "uber.com", "doordash.com",
  "quip.com", "nba.com", "warriors.com", "budgettravel.com",
];

const FREIGHT_ATTACHMENT_TYPES = [
  ".pdf", ".xlsx", ".xls", ".csv", ".doc", ".docx",
];

export interface ClassifierResult {
  score: number;
  shippingRelevant: boolean;
  needsClaude: boolean;
  signals: string[];
}

export function classifyEmail(email: {
  fromEmail: string;
  subject: string;
  body: string;
  attachments?: Array<{ filename: string; mimeType: string }>;
}): ClassifierResult {
  const text = `${email.subject} ${email.body}`.toLowerCase();
  const domain = email.fromEmail.split("@")[1]?.toLowerCase() || "";
  const signals: string[] = [];
  let score = 0;

  // Sender domain trust
  const parentDomains = domain.split(".").reduce((acc: string[], _, i, arr) => {
    if (i < arr.length - 1) acc.push(arr.slice(i).join("."));
    return acc;
  }, []);

  if (CARRIER_DOMAINS.some((d) => parentDomains.includes(d))) {
    score += 0.3;
    signals.push("carrier-domain");
  }

  if (NOISE_DOMAINS.some((d) => parentDomains.includes(d))) {
    score -= 0.5;
    signals.push("noise-domain");
  }

  // High-value keyword density
  const highHits = FREIGHT_KEYWORDS_HIGH.filter((kw) => text.includes(kw));
  if (highHits.length >= 3) {
    score += 0.4;
    signals.push(`high-kw:${highHits.length}`);
  } else if (highHits.length >= 1) {
    score += 0.2;
    signals.push(`high-kw:${highHits.length}`);
  }

  // Medium keyword density
  const medHits = FREIGHT_KEYWORDS_MED.filter((kw) => text.includes(kw));
  if (medHits.length >= 3) {
    score += 0.2;
    signals.push(`med-kw:${medHits.length}`);
  } else if (medHits.length >= 1) {
    score += 0.1;
    signals.push(`med-kw:${medHits.length}`);
  }

  // Attachment types boost
  if (email.attachments?.length) {
    const freightAttachments = email.attachments.filter((a) =>
      FREIGHT_ATTACHMENT_TYPES.some((ext) => a.filename?.toLowerCase().endsWith(ext))
    );
    if (freightAttachments.length > 0) {
      score += 0.15;
      signals.push(`freight-attachments:${freightAttachments.length}`);
    }
  }

  // Port code detection (strong signal)
  const portCodes = text.match(/\b[A-Z]{2}[A-Z]{3}\b/g) || [];
  const knownPorts = ["NGAPP", "NGTCN", "NGONE", "NGWAR", "NLRTM", "DEHAM", "CNSHA", "CNTAO", "AEJEA", "BEANR", "TRIST", "GHTEM", "KEMBA", "SGSIN", "CNNGB"];
  const portHits = portCodes.filter((p) => knownPorts.includes(p.toUpperCase()));
  if (portHits.length > 0) {
    score += 0.2;
    signals.push(`port-codes:${portHits.length}`);
  }

  // Promo signals (negative)
  const promoPatterns = [
    /% off/i, /flash sale/i, /limited time/i, /shop now/i,
    /free shipping.*(?:ends|today|sitewide)/i, /clearance/i,
    /use code/i, /promo code/i, /coupon/i, /subscribe/i,
    /unsubscribe/i, /view in browser/i,
  ];
  const promoHits = promoPatterns.filter((p) => p.test(text));
  if (promoHits.length >= 2) {
    score -= 0.4;
    signals.push(`promo-signals:${promoHits.length}`);
  } else if (promoHits.length === 1) {
    score -= 0.15;
    signals.push(`promo-signal:1`);
  }

  // Clamp score
  score = Math.max(0, Math.min(1, score));

  return {
    score,
    shippingRelevant: score >= 0.6,
    needsClaude: score >= 0.4 && score < 0.6,
    signals,
  };
}
