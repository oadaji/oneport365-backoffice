import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY });

export interface SingleExtraction {
  label: string;
  fields: Array<{ k: string; v: string; ok: boolean }>;
  missing: string[];
  draft: string | null;
  status: string;
}

export interface MultiExtraction {
  shipments: SingleExtraction[];
  combinedDraft: string | null;
  detectedEmailType?: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function extractWithClaude(
  email: { fromName: string; fromEmail: string; subject: string; body: string },
  emailTypeHint: string
): Promise<MultiExtraction> {
  const cleanBody = stripHtml(email.body).slice(0, 6000);

  const prompt = `You are an AI freight RFQ extraction assistant for OnePort 365, a Nigerian freight forwarder.

STEP 1 — EMAIL TYPE CLASSIFICATION
Classify this email as ONE of:
- "customer-rfq": a customer asking for a freight rate/quote/shipping price
- "rate-reply": a shipping line/carrier replying with rates
- "internal-rfq": internal team forwarding a customer request
- "outbound": an outbound email sent BY OnePort (not an enquiry)

STEP 2 — MULTI-SHIPMENT DETECTION
If the email contains multiple distinct shipment requests (different commodities, different origins/destinations, phrases like "also need", "another shipment"), extract each as a separate shipment.

STEP 3 — EXTRACT THESE FIELDS FOR EACH SHIPMENT
For each shipment, extract:
1. Customer — sender name or company
2. Company — company name if identifiable
3. Freight Mode — "ocean" or "air" or "unknown"
4. POL — Port of Loading with LOCODE (e.g. "Shanghai (CNSHA)")
5. POD — Port of Discharge with LOCODE (e.g. "Apapa (NGAPP)")
6. Commodity — what is being shipped
7. HS Code — if mentioned or inferable
8. Weight — in MT or KG
9. Volume — in CBM
10. Pick-up — origin pickup address if mentioned
11. Container — type and quantity (e.g. "2x40FT")
12. Cargo class — "General Cargo" or "Dangerous Goods" with class
13. Incoterm — EXW, FOB, CIF, etc.
14. Target Price — if customer mentions a budget

Nigerian port codes: Apapa=NGAPP, Tin Can=NGTCN, Onne=NGONE, Warri=NGWAR, Calabar=NGCBQ
Common ports: Shanghai=CNSHA, Ningbo=CNNGB, Qingdao=CNTAO, Rotterdam=NLRTM, Hamburg=DEHAM, Istanbul=TRIST, Felixstowe=GBFXT, Dubai/Jebel Ali=AEJEA, Mumbai/Nhava Sheva=INNSZ, Singapore=SGSIN

STEP 4 — FOLLOW-UP DRAFT
If any required fields are missing, generate a professional follow-up email draft asking the customer for the missing information. Address them by name.

EMAIL:
From: ${email.fromName} <${email.fromEmail}>
Subject: ${email.subject}
Hint type: ${emailTypeHint}

Body:
${cleanBody}

Respond with ONLY valid JSON:
{
  "detectedEmailType": "customer-rfq|rate-reply|internal-rfq|outbound",
  "shipments": [
    {
      "label": "Shipment description",
      "fields": [{"k": "POL", "v": "Shanghai (CNSHA)", "ok": true}, ...],
      "missing": ["HS Code", "Volume"],
      "draft": "Dear ..., To complete your quote...",
      "status": "info_needed|ready|new"
    }
  ],
  "combinedDraft": "Dear ..., (combined follow-up for all shipments)" or null
}

Rules:
- Set "ok": true only if the value is actually present and specific
- Set "ok": false and v to "not specified" if missing
- status = "ready" if ALL of: POL, POD, Commodity, Container are present
- status = "info_needed" if any required field is missing
- If not a customer-rfq, return empty shipments array`;

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (response.content[0] as any).text || "";
    const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    return {
      shipments: parsed.shipments || [],
      combinedDraft: parsed.combinedDraft || null,
      detectedEmailType: parsed.detectedEmailType,
    };
  } catch (err: any) {
    console.error("Claude extraction failed:", err?.message || err);
    return {
      shipments: [{
        label: "Extraction failed",
        fields: [
          { k: "Customer", v: email.fromName, ok: true },
          { k: "Email", v: email.fromEmail, ok: true },
        ],
        missing: ["POL", "POD", "Commodity", "Container"],
        draft: null,
        status: "info_needed",
      }],
      combinedDraft: null,
    };
  }
}

// Pre-classification: catches obvious non-RFQs before calling Claude
export function preClassifyEmail(email: { fromName: string; fromEmail: string; subject: string; body: string }): string | null {
  const subj = email.subject.toLowerCase();
  const body = email.body.toLowerCase();
  const from = email.fromName.toLowerCase();

  // Outbound detection
  if (/^rate request\s*[-–—]/.test(subj)) return "outbound";
  if (body.includes("oneport 365 commercial") || body.includes("oneport 365 rates team")) return "outbound";
  if (/oneport\s*365\s*(rates|commercial|team|ops)/i.test(from) && !subj.startsWith("re:")) return "outbound";

  // Rate reply detection
  if (/^re:\s*rate request\s*[-–—]/i.test(subj)) {
    const rateSignals = [/\$\s*\d/, /usd\s*\d/i, /40ft|40hc|20ft/i, /valid/i, /transit/i];
    if (rateSignals.filter((r) => r.test(body)).length >= 2) return "rate-reply";
  }

  // Strong rate sheet signals
  const sheetSignals = [/\$\s*\d/, /40ft|40hc/i, /valid\s*(from|to|until|till)/i, /transit\s*time/i, /carrier/i];
  if (sheetSignals.filter((r) => r.test(body)).length >= 3) return "rate-reply";

  return null;
}
