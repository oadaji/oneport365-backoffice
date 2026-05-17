import Anthropic from "@anthropic-ai/sdk";
import { OceanFreightRate, HaulageImportRate, HaulageExportRate, OtherCharge } from "../models/rate";
import { AppSetting } from "../models/market";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface RfqData {
  ref: string;
  fields: Array<{ k: string; v: string; ok: boolean }>;
  companyName?: string;
  customerName?: string;
  contactEmail?: string;
  companyId?: string;
  contactId?: string;
}

export interface QuoteAIResult {
  selectedOceanRateId: string | null;
  carrier: string;
  oceanAmount: number;
  oceanCurrency: string;
  transitTime: string;
  freeTime: string;
  polLabel: string;
  podLabel: string;
  originCharges: Array<{
    id: string | null;
    itemName: string;
    amount: number | null;
    currency: string;
    asPerReceipt: boolean;
    category: string;
    basis: string;
  }>;
  destCharges: Array<{
    id: string | null;
    itemName: string;
    amount: number | null;
    currency: string;
    asPerReceipt: boolean;
    category: string;
    basis: string;
  }>;
  selectedHaulageRateId: string | null;
  hasSuggestedHaulage: boolean;
  haulageTerminal: string | null;
  haulageDestCity: string | null;
  haulageAmount: number | null;
  haulageCurrency: string;
  notes: string;
  marginPct: number;
  exchangeRate: number;
}

function fieldVal(fields: Array<{ k: string; v: string; ok: boolean }>, key: string): string {
  const f = fields.find((x) => x.k.toLowerCase().includes(key.toLowerCase()));
  return f?.v && f.v !== "not specified" ? f.v : "";
}

function extractPortCode(raw: string): string {
  // Try to extract LOCODE like NLRTM, NGAPP, CNSHA from strings like "Rotterdam (NLRTM)"
  const match = raw.match(/\(([A-Z]{5})\)/);
  if (match) return match[1];
  // Try bare 5-letter code
  const bare = raw.match(/\b([A-Z]{5})\b/);
  if (bare) return bare[1];
  return "";
}

function detectDirection(fields: Array<{ k: string; v: string; ok: boolean }>): string {
  const pod = fieldVal(fields, "pod").toLowerCase();
  const pol = fieldVal(fields, "pol").toLowerCase();
  const nigerianMarkers = ["nigeria", "ngapp", "ngtcn", "ngone", "ngwar", "ngcbq", "lagos", "apapa", "tin can", "onne", "warri"];
  if (nigerianMarkers.some((m) => pod.includes(m))) return "import";
  if (nigerianMarkers.some((m) => pol.includes(m))) return "export";
  return "cross-trade";
}

async function getSettings(): Promise<{ exchangeRate: number; marginPct: number }> {
  const exRate = await AppSetting.findOne({ key: "exchangeRate" });
  const margin = await AppSetting.findOne({ key: "defaultMargin" });
  return {
    exchangeRate: exRate ? parseFloat(String(exRate.value)) || 1600 : 1600,
    marginPct: margin ? parseFloat(String(margin.value)) || 13 : 13,
  };
}

export async function generateQuoteFromRfq(rfq: RfqData): Promise<QuoteAIResult> {
  const fields = rfq.fields;
  const rawPol = fieldVal(fields, "pol");
  const rawPod = fieldVal(fields, "pod");
  const polCode = extractPortCode(rawPol);
  const podCode = extractPortCode(rawPod);
  const commodity = fieldVal(fields, "commodity") || "General Cargo";
  const containerType = fieldVal(fields, "container") || "40ft";
  const containerQty = parseInt(fieldVal(fields, "qty") || fieldVal(fields, "quantity")) || 1;
  const customerName = rfq.customerName || fieldVal(fields, "customer") || "Unknown";
  const companyName = rfq.companyName || fieldVal(fields, "company") || "Unknown";
  const shipmentDir = detectDirection(fields);

  const { exchangeRate, marginPct } = await getSettings();

  // Fetch matching rates
  const now = new Date();

  // Ocean rates: match by polCode/podCode, or broader if no exact match
  let oceanPool = await OceanFreightRate.find({
    archived: false,
    expiryDate: { $gte: now },
    polCode: polCode || undefined,
    podCode: podCode || undefined,
  }).lean();

  // If no exact match, try partial matches
  if (oceanPool.length === 0 && (polCode || podCode)) {
    const orConditions: any[] = [];
    if (polCode) orConditions.push({ polCode });
    if (podCode) orConditions.push({ podCode });
    oceanPool = await OceanFreightRate.find({
      archived: false,
      expiryDate: { $gte: now },
      $or: orConditions,
    }).lean();
  }

  // If still none, get all active rates so Claude can pick the closest
  if (oceanPool.length === 0) {
    oceanPool = await OceanFreightRate.find({
      archived: false,
      expiryDate: { $gte: now },
    }).limit(20).lean();
  }

  // Other charges matching shipment direction
  const chargeFilter: any = { archived: { $ne: true } };
  if (shipmentDir === "import") {
    chargeFilter.shipmentType = { $in: ["import", "both"] };
  } else if (shipmentDir === "export") {
    chargeFilter.shipmentType = { $in: ["export", "both"] };
  }
  const applicableCharges = await OtherCharge.find(chargeFilter).lean();

  // Haulage rates
  let haulagePool: any[] = [];
  if (shipmentDir === "import") {
    const haulageFilter: any = {};
    if (podCode) haulageFilter.portCode = podCode;
    haulagePool = await HaulageImportRate.find({ archived: { $ne: true }, ...haulageFilter }).lean();
    // If no match by port code, get all
    if (haulagePool.length === 0) {
      haulagePool = await HaulageImportRate.find({ archived: { $ne: true } }).limit(15).lean();
    }
  } else if (shipmentDir === "export") {
    const haulageFilter: any = {};
    if (polCode) haulageFilter.portCode = polCode;
    haulagePool = await HaulageExportRate.find({ archived: { $ne: true }, ...haulageFilter }).lean();
    if (haulagePool.length === 0) {
      haulagePool = await HaulageExportRate.find({ archived: { $ne: true } }).limit(15).lean();
    }
  }

  // Build the prompt
  const prompt = `You are a freight quoting assistant for OnePort 365, a Nigerian freight forwarding company.

Given the following RFQ and available rates, build a complete freight quote.

RFQ Details:
- RFQ Ref: ${rfq.ref}
- POL (raw): ${rawPol}  →  Extracted Code: ${polCode}
- POD (raw): ${rawPod}  →  Extracted Code: ${podCode}
- Commodity: ${commodity}
- Container Type: ${containerType}
- Container Qty: ${containerQty}
- Customer: ${customerName}
- Company: ${companyName}
- Shipment Direction: ${shipmentDir}
- Raw Fields: ${JSON.stringify(fields.slice(0, 20))}

Available Ocean Freight Rates (${oceanPool.length} options):
${JSON.stringify(oceanPool.slice(0, 15), null, 2)}

Available Other Charges (${applicableCharges.length} items):
${JSON.stringify(applicableCharges.slice(0, 30), null, 2)}

Available Haulage Rates (${haulagePool.length} options, sorted by destination-city match relevance):
${JSON.stringify(haulagePool.slice(0, 15), null, 2)}

Instructions:
1. Select the BEST ocean freight rate from the available options. Pick the most appropriate rate matching the container type (${containerType}). If none match exactly, pick the closest and note the mismatch.
2. Select relevant other charges for this shipment type (${shipmentDir}). For import include: Agency Clearance Fee, THC, Shipping Line Charges, Form M/Documentation, Son Fee, PAAR, Scanning Fee. For export: export doc fee, THC, NXP form, VGM, stuffing fee.
3. HAULAGE RULE — always commit to a rate if haulage rates are provided:
   - FIRST look for a rate where destCity exactly matches a place name mentioned in the raw POD string (e.g. POD "Alaba Intl Market" → prefer destCity="Alaba"). Use that rate even if its origin terminal differs from the ocean discharge port.
   - If no destCity matches, pick the rate from the terminal that matches the ocean discharge port and the closest destination.
   - Set hasSuggestedHaulage=true and fill selectedHaulageRateId and haulageAmount with the actual number from the chosen rate.
   - Only leave haulageAmount null if the haulage rates array is completely empty.
4. Mark asPerReceipt=true only for charges where price is genuinely variable (THC, demurrage, scanning).
5. Use exchange rate ${exchangeRate} NGN/USD for cost calculations.

Respond with ONLY valid JSON in this exact format:
{
  "selectedOceanRateId": "<id string or null>",
  "carrier": "<carrier name>",
  "oceanAmount": <number in USD>,
  "oceanCurrency": "USD",
  "transitTime": "<e.g. 22 days>",
  "freeTime": "<e.g. 14 days>",
  "polLabel": "<e.g. Apapa (NGAPP) Nigeria>",
  "podLabel": "<e.g. Rotterdam (NLRTM) Netherlands>",
  "originCharges": [
    {"id": "<id string or null>", "itemName": "<name>", "amount": <number or null>, "currency": "NGN", "asPerReceipt": <bool>, "category": "<category>", "basis": "<Per Container|Per BL|Per Shipment>"}
  ],
  "destCharges": [],
  "selectedHaulageRateId": "<id string or null>",
  "hasSuggestedHaulage": <bool>,
  "haulageTerminal": "<terminal name or null>",
  "haulageDestCity": "<city or null>",
  "haulageAmount": <number or null>,
  "haulageCurrency": "NGN",
  "notes": "<brief reasoning>",
  "marginPct": ${marginPct},
  "exchangeRate": ${exchangeRate}
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as any).text)
    .join("");

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  const result: QuoteAIResult = JSON.parse(jsonStr.trim());
  return result;
}
