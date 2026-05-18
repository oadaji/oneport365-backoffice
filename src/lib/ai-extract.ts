import Anthropic from "@anthropic-ai/sdk";

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("No Claude API key set (ANTHROPIC_API_KEY or CLAUDE_API_KEY)");
  return new Anthropic({ apiKey });
}

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
  const cleanBody = stripHtml(email.body).slice(0, 15000);

  const prompt = `You are a freight operations assistant at OnePort 365, a Nigerian logistics company.
Analyze this email and extract shipment/RFQ details.

EMAIL TYPE CLASSIFICATION — classify as ONE of:
- "customer-rfq": A shipper/importer/exporter asking for a freight rate or shipping quote. The sender NEEDS a service.
- "rate-reply": A carrier/shipping line sending rate sheets, tariffs, pricing. The sender is PROVIDING rates.
- "internal-rfq": Sent by an internal OnePort 365 team member requesting rates or forwarding a customer request.
- "outbound": An email sent BY OnePort 365 TO a partner/customer/carrier.
- "promotional": Marketing, retail, e-commerce, newsletter, "free shipping" offers on products — NOT real freight.
- "irrelevant": Personal, social, financial, calendar invite, unrelated to freight forwarding.

CRITICAL: Only "customer-rfq" or "internal-rfq" if actual cargo needs physical shipping between ports/countries. Retail "free shipping" is NEVER freight.

SIGNALS for "outbound": subject starts with "Rate Request —"; body contains "rate request on behalf of OnePort 365"; from-name contains "OnePort 365".
SIGNALS for "rate-reply": "please find our rates", "all-in rate", rate tables with USD per container, "validity", "transit time", "Option 1/Option 2" with prices.
SIGNALS for "customer-rfq": sender asks "how much", "need price", "kindly quote", describes goods to ship.

INTERNAL FORWARD RULE: If From address ends in @oneport365.com, the email was forwarded internally. Scan the body for the original external sender (look for "From: Name <external@domain.com>" lines NOT ending in @oneport365.com). Set Customer to that name, Company from their signature/domain, Email to the external address. Classify as "customer-rfq" if body contains a forwarded customer enquiry.

MULTI-SHIPMENT: Detect multiple distinct shipments (different commodities, origins/destinations, "also need", "another shipment"). Extract each separately.

FREIGHT MODE per shipment:
- "ocean": 20FT/40FT/40HC/FCL/LCL/container/TEU/vessel/shipping line/bill of lading
- "air": airway bill/AWB/air freight/airline/flight/chargeable weight
- "unknown": insufficient signals

PORT RESOLUTION — resolve to nearest seaport/airport + LOCODE/IATA:
Ocean: Lagos/Apapa→Apapa(NGAPP), Tin Can→Tin Can(NGTCN), Onne→Onne(NGONE), Warri→Warri(NGWAR), Rotterdam→Rotterdam(NLRTM), Hamburg→Hamburg(DEHAM), Shanghai→Shanghai(CNSHA), Qingdao→Qingdao(CNTAO), Dubai/Jebel Ali→Jebel Ali(AEJEA), Antwerp→Antwerp(BEANR), Istanbul→Ambarlı(TRIST), Tema/Accra→Tema(GHTEM), Mombasa→Mombasa(KEMBA), Singapore→Singapore(SGSIN), Ningbo→Ningbo(CNNGB), Shenzhen/Yantian→Yantian(CNYTN), Busan→Busan(KRPUS), Durban→Durban(ZADUR), Houston→Houston(USHOU), Los Angeles→Los Angeles(USLAX), San Francisco→Oakland(USOAK)
Air: Lagos→Lagos(LOS), Dubai→Dubai(DXB), London→Heathrow(LHR), Frankfurt→Frankfurt(FRA), Hong Kong→Hong Kong(HKG), Shanghai→Pudong(PVG), Nairobi→Nairobi(NBO)

EXTRACT 14 FIELDS per shipment:
1. Customer — sender name
2. Company — company name
3. Freight Mode — "Ocean Freight" or "Air Freight" or "Not specified"
4. POL — Port of Loading with LOCODE e.g. "Shanghai (CNSHA)"
5. POD — Port of Discharge with LOCODE e.g. "Apapa (NGAPP)"
6. Commodity — cargo description
7. HS Code — if mentioned; if commodity known suggest "<code> (suggested)" with ok=false, do NOT add to missing[]
8. Weight — gross weight in MT or KG
9. Volume — FCL: container count ("2","3") NEVER ask for CBM on FCL. LCL: CBM. Air: chargeable weight kg.
10. Pick-up — origin address/city
11. Container — "20FT" or "40FT" or "40HC" or "LCL" with quantity e.g. "2x40FT"
12. Cargo class — "General Cargo" or "Dangerous Goods Class X.X"
13. Incoterm — FOB/EXW/CIF/DDP/DAP/CFR etc.
14. Target Price — budget/target if mentioned

FIELD RULES:
- ok=true ONLY if value explicitly stated in email
- ok=false with v="not specified" if missing
- Contact/Email NEVER in missing[] — taken from sender
- status="ready" if missing=[], else "info_needed"
- If not customer-rfq/internal-rfq/rate-reply, return empty shipments array

FOLLOW-UP DRAFT: If fields missing, generate professional email from "Commercial Team · OnePort 365" asking for missing info. Address by name.

Email type hint: ${emailTypeHint}
From: ${email.fromName} <${email.fromEmail}>
Subject: ${email.subject}

Body:
${cleanBody}

Return ONLY valid JSON:
{
  "detectedEmailType": "customer-rfq|rate-reply|internal-rfq|outbound|promotional|irrelevant",
  "shipments": [
    {
      "label": "Short label e.g. 'Cashew nuts · Apapa (NGAPP) → Jebel Ali (AEJEA)'",
      "fields": [
        {"k":"Customer","v":"<name>","ok":true},
        {"k":"Company","v":"<company>","ok":true},
        {"k":"Freight Mode","v":"Ocean Freight","ok":true},
        {"k":"POL","v":"Shanghai (CNSHA)","ok":true},
        {"k":"POD","v":"Apapa (NGAPP)","ok":true},
        {"k":"Commodity","v":"<description>","ok":true},
        {"k":"HS Code","v":"<code> or 'not specified'","ok":false},
        {"k":"Weight","v":"<weight> or 'not specified'","ok":false},
        {"k":"Volume","v":"<count/CBM> or 'not specified'","ok":false},
        {"k":"Pick-up","v":"<address> or 'not specified'","ok":false},
        {"k":"Container","v":"2x40FT or 'not specified'","ok":false},
        {"k":"Cargo class","v":"General Cargo","ok":true},
        {"k":"Incoterm","v":"FOB or 'not specified'","ok":false},
        {"k":"Target Price","v":"<budget> or 'not specified'","ok":false}
      ],
      "missing": ["specific question for each missing required field"],
      "draft": null,
      "status": "info_needed|ready"
    }
  ],
  "combinedDraft": "single follow-up email covering ALL shipments, or null if nothing missing"
}`;

  try {
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
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
    console.error("Claude extraction failed for:", email.subject?.slice(0, 50));
    console.error("  Error:", err?.message || err);
    console.error("  Error type:", err?.constructor?.name);
    // Return empty shipments + "irrelevant" type so failed extractions are SKIPPED
    return {
      shipments: [],
      combinedDraft: null,
      detectedEmailType: "irrelevant",
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
