import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { postProcessPortCodes } from "./port-codes";

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("No Claude API key set (ANTHROPIC_API_KEY or CLAUDE_API_KEY)");
  return new Anthropic({ apiKey });
}

export interface SingleExtraction {
  label: string;
  fields: Array<{ k: string; v: string; ok: boolean; suggested?: boolean }>;
  missing: string[];
  draft: string | null;
  status: string;
}

export interface MultiExtractionOk {
  status: "ok";
  shipments: SingleExtraction[];
  combinedDraft: string | null;
  detectedEmailType?: string;
}

export interface MultiExtractionError {
  status: "error";
  error: string;
  errorType: "rate_limit" | "parse" | "network" | "unknown";
}

export type MultiExtraction = MultiExtractionOk | MultiExtractionError;

// ── Zod schema for Claude's tool output ──

const FieldSchema = z.object({
  k: z.string(),
  v: z.string(),
  ok: z.boolean(),
  suggested: z.boolean().optional(),
});

const ShipmentSchema = z.object({
  label: z.string(),
  fields: z.array(FieldSchema),
  missing: z.array(z.string()),
  draft: z.string().nullable(),
  status: z.string(),
});

const ExtractionSchema = z.object({
  detectedEmailType: z.enum(["customer-rfq", "rate-reply", "internal-rfq", "outbound", "promotional", "irrelevant"]),
  shipments: z.array(ShipmentSchema),
  combinedDraft: z.string().nullable(),
});

// ── Tool definition for Claude ──

const EXTRACT_RFQ_TOOL: Anthropic.Messages.Tool = {
  name: "extract_rfq",
  description: "Extract RFQ shipment details and classify the email type.",
  input_schema: {
    type: "object" as const,
    properties: {
      detectedEmailType: {
        type: "string",
        enum: ["customer-rfq", "rate-reply", "internal-rfq", "outbound", "promotional", "irrelevant"],
        description: "Classification of the email type",
      },
      shipments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Short label e.g. 'Cashew nuts · Apapa (NGAPP) → Jebel Ali (AEJEA)'" },
            fields: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  k: { type: "string", description: "Field key" },
                  v: { type: "string", description: "Field value" },
                  ok: { type: "boolean", description: "true if value explicitly stated in email" },
                  suggested: { type: "boolean", description: "true if value is an AI suggestion (e.g. HS Code inferred from commodity)" },
                },
                required: ["k", "v", "ok"],
              },
            },
            missing: { type: "array", items: { type: "string" }, description: "Specific question for each missing required field" },
            draft: { type: ["string", "null"], description: "Follow-up draft for this shipment, or null" },
            status: { type: "string", enum: ["info_needed", "ready"], description: "ready if missing=[], else info_needed" },
          },
          required: ["label", "fields", "missing", "draft", "status"],
        },
      },
      combinedDraft: {
        type: ["string", "null"],
        description: "Single follow-up email covering ALL shipments, or null if nothing missing",
      },
    },
    required: ["detectedEmailType", "shipments", "combinedDraft"],
  },
};

// ── Static system prompt (cached) ──

const SYSTEM_PROMPT = `You are a freight operations assistant at OnePort 365, a Nigerian logistics company.
Analyze emails and extract shipment/RFQ details using the extract_rfq tool.

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

PORT RESOLUTION: Resolve port names to nearest seaport/airport with LOCODE/IATA code in format "City (CODE)". Example: "Shanghai (CNSHA)", "Apapa (NGAPP)", "Lagos (LOS)".

EXTRACT 14 FIELDS per shipment:
1. Customer — sender name
2. Company — company name
3. Freight Mode — "Ocean Freight" or "Air Freight" or "Not specified"
4. POL — Port of Loading with LOCODE e.g. "Shanghai (CNSHA)"
5. POD — Port of Discharge with LOCODE e.g. "Apapa (NGAPP)"
6. Commodity — cargo description
7. HS Code — if mentioned use it with ok=true. If commodity is known but HS code not stated, suggest a likely code with ok=true AND suggested=true (e.g. "8471.30"). Do NOT add HS Code to missing[] when a suggestion is provided.
8. Weight — gross weight in MT or KG
9. Volume — FCL: container count ("2","3") NEVER ask for CBM on FCL. LCL: CBM. Air: chargeable weight kg.
10. Pick-up — origin address/city
11. Container — "20FT" or "40FT" or "40HC" or "LCL" with quantity e.g. "2x40FT"
12. Cargo class — "General Cargo" or "Dangerous Goods Class X.X"
13. Incoterm — FOB/EXW/CIF/DDP/DAP/CFR etc.
14. Target Price — budget/target if mentioned

FIELD RULES:
- ok=true ONLY if value explicitly stated in email (exception: HS Code suggestions use ok=true, suggested=true)
- ok=false with v="not specified" if missing
- Contact/Email NEVER in missing[] — taken from sender
- status="ready" if missing=[], else "info_needed"
- If not customer-rfq/internal-rfq/rate-reply, return empty shipments array

FOLLOW-UP DRAFT: If fields missing, generate a warm, professional email under 120 words from "Commercial Team · OnePort 365" asking for missing info. Address the customer by name. Use a numbered list for missing items. For multi-shipment, label sections per shipment.`;

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]*\.(png|gif|jpg|jpeg)[^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyError(err: any): MultiExtractionError["errorType"] {
  const msg = err?.message || "";
  if (err?.status === 429 || msg.includes("rate_limit") || msg.includes("429")) return "rate_limit";
  if (err instanceof SyntaxError || msg.includes("JSON")) return "parse";
  if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT") || msg.includes("fetch failed") || msg.includes("network")) return "network";
  return "unknown";
}

export async function extractWithClaude(
  email: { fromName: string; fromEmail: string; subject: string; body: string },
  emailTypeHint: string
): Promise<MultiExtraction> {
  const cleanBody = stripHtml(email.body).slice(0, 15000);

  const userMessage = `Email type hint: ${emailTypeHint}
From: ${email.fromName} <${email.fromEmail}>
Subject: ${email.subject}

Body:
${cleanBody}

Use the extract_rfq tool to classify this email and extract shipment details.`;

  try {
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
      tools: [EXTRACT_RFQ_TOOL],
      tool_choice: { type: "tool", name: "extract_rfq" },
    });

    // Find the tool_use content block
    const toolBlock = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use" && block.name === "extract_rfq"
    );

    if (!toolBlock) {
      return {
        status: "error" as const,
        error: "Claude did not return a tool_use block",
        errorType: "parse",
      };
    }

    // Validate with Zod
    const parseResult = ExtractionSchema.safeParse(toolBlock.input);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i: any) => `${i.path.join(".")}: ${i.message}`).join("; ");
      console.error("Extraction Zod validation failed:", issues);
      return {
        status: "error" as const,
        error: `Validation failed: ${issues}`,
        errorType: "parse",
      };
    }

    const parsed = parseResult.data;

    // Post-process: resolve bare port names to LOCODE format
    const shipments = parsed.shipments.map((s) => ({
      ...s,
      fields: postProcessPortCodes(s.fields),
    }));

    return {
      status: "ok" as const,
      shipments,
      combinedDraft: parsed.combinedDraft,
      detectedEmailType: parsed.detectedEmailType,
    };
  } catch (err: any) {
    console.error("Claude extraction failed for:", email.subject?.slice(0, 50));
    console.error("  Error:", err?.message || err);
    console.error("  Error type:", err?.constructor?.name);

    return {
      status: "error" as const,
      error: (err?.message as string) || "Unknown extraction error",
      errorType: classifyError(err),
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
