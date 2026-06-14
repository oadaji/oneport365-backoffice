import * as XLSX from "xlsx";
import {
  RateConnector,
  ConnectorInput,
  ConnectorResult,
  NormalizedRate,
  FileConnectorInput,
} from "./types";
import { Carrier } from "../../models/reference-data";

/**
 * Expected column headers in rate sheet (case-insensitive)
 */
const COLUMN_MAP: Record<string, string> = {
  carrier: "carrier",
  "carrier name": "carrier",
  "shipping line": "carrier",
  scac: "scac",
  origin: "origin",
  pol: "origin",
  "port of loading": "origin",
  destination: "destination",
  pod: "destination",
  "port of discharge": "destination",
  equipment: "equipment",
  "container type": "equipment",
  "cntr type": "equipment",
  currency: "currency",
  ccy: "currency",
  "ocean freight": "oceanFreight",
  "freight rate": "oceanFreight",
  ofr: "oceanFreight",
  thc: "thc",
  "terminal handling": "thc",
  doc: "doc",
  documentation: "doc",
  "doc fee": "doc",
  baf: "baf",
  "bunker adjustment": "baf",
  isps: "isps",
  security: "isps",
  "valid from": "validFrom",
  "effective date": "validFrom",
  "validity start": "validFrom",
  "valid to": "validTo",
  "expiry date": "validTo",
  "validity end": "validTo",
  expiry: "validTo",
  transit: "transitDays",
  "transit time": "transitDays",
  "transit days": "transitDays",
  service: "service",
  "service name": "service",
  "rate type": "rateType",
  type: "rateType",
  via: "via",
  transshipment: "via",
};

interface ParsedRow {
  carrier?: string;
  scac?: string;
  origin?: string;
  destination?: string;
  equipment?: string;
  currency?: string;
  oceanFreight?: number;
  thc?: number;
  doc?: number;
  baf?: number;
  isps?: number;
  validFrom?: Date;
  validTo?: Date;
  transitDays?: number;
  service?: string;
  rateType?: string;
  via?: string;
}

/**
 * Normalize column header to standard field name
 */
function normalizeHeader(header: string): string | null {
  const normalized = header.toLowerCase().trim();
  return COLUMN_MAP[normalized] || null;
}

/**
 * Parse date from various formats
 */
function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined;

  // Excel serial date number
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d);
    }
  }

  // String date
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Already a Date
  if (value instanceof Date) {
    return value;
  }

  return undefined;
}

/**
 * Parse number from cell value
 */
function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const num = typeof value === "number" ? value : parseFloat(String(value).replace(/[,$]/g, ""));
  return isNaN(num) ? undefined : num;
}

/**
 * Normalize equipment code
 */
function normalizeEquipment(value: string): string {
  const upper = value.toUpperCase().replace(/['\s-]/g, "");
  const mapping: Record<string, string> = {
    "20GP": "20GP",
    "20DV": "20GP",
    "20ST": "20GP",
    "20FT": "20GP",
    "40GP": "40GP",
    "40DV": "40GP",
    "40ST": "40GP",
    "40FT": "40GP",
    "40HC": "40HC",
    "40HQ": "40HC",
    "40HI": "40HC",
    "20RF": "20RF",
    "20RE": "20RF",
    "40RF": "40RF",
    "40RE": "40RF",
    "40RH": "40RF",
    "20OT": "20OT",
    "40OT": "40OT",
    "20FR": "20FR",
    "40FR": "40FR",
  };
  return mapping[upper] || upper;
}

/**
 * Ratesheet connector — parses Excel/CSV files into canonical rates
 */
export class RatesheetConnector implements RateConnector {
  readonly source = "ratesheet" as const;
  readonly name = "Rate Sheet Importer";

  isConfigured(): boolean {
    return true; // No external config needed
  }

  async fetchRates(input: ConnectorInput): Promise<ConnectorResult> {
    if (input.type !== "file") {
      return {
        success: false,
        rates: [],
        errors: ["RatesheetConnector requires file input"],
      };
    }

    return this.parseFile(input);
  }

  private async parseFile(input: FileConnectorInput): Promise<ConnectorResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const rates: NormalizedRate[] = [];

    try {
      // Parse workbook from buffer
      const workbook = XLSX.read(input.buffer, { type: "buffer", cellDates: true });

      // Use first sheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return { success: false, rates: [], errors: ["No sheets found in workbook"] };
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      if (rows.length === 0) {
        return { success: false, rates: [], errors: ["Sheet is empty"] };
      }

      // Map headers to our standard fields
      const firstRow = rows[0];
      const headerMap: Record<string, string> = {};
      for (const key of Object.keys(firstRow)) {
        const normalized = normalizeHeader(key);
        if (normalized) {
          headerMap[key] = normalized;
        }
      }

      // Validate required columns
      const mappedFields = new Set(Object.values(headerMap));
      const requiredFields = ["carrier", "origin", "destination", "equipment"];
      const missingRequired = requiredFields.filter((f) => !mappedFields.has(f));
      if (missingRequired.length > 0) {
        return {
          success: false,
          rates: [],
          errors: [`Missing required columns: ${missingRequired.join(", ")}`],
        };
      }

      // Load carrier reference for SCAC lookup
      const carriers = await Carrier.find({ active: true }).lean();
      const carrierByName = new Map<string, { name: string; scac: string }>();
      for (const c of carriers) {
        carrierByName.set(c.name.toLowerCase(), { name: c.name, scac: c.scac });
        for (const alias of c.aliases) {
          carrierByName.set(alias.toLowerCase(), { name: c.name, scac: c.scac });
        }
      }

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2; // 1-indexed, plus header row
        const row = rows[i];

        try {
          const parsed = this.parseRow(row, headerMap);
          const rate = this.toNormalizedRate(parsed, carrierByName, input.filename);

          if (rate) {
            rates.push(rate);
          } else {
            warnings.push(`Row ${rowNum}: Skipped - missing required data`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Row ${rowNum}: ${msg}`);
        }
      }

      return {
        success: errors.length === 0,
        rates,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        rates: [],
        errors: [`Failed to parse file: ${msg}`],
      };
    }
  }

  private parseRow(row: Record<string, unknown>, headerMap: Record<string, string>): ParsedRow {
    const parsed: ParsedRow = {};

    for (const [originalKey, normalizedKey] of Object.entries(headerMap)) {
      const value = row[originalKey];

      switch (normalizedKey) {
        case "carrier":
          parsed.carrier = value ? String(value).trim() : undefined;
          break;
        case "scac":
          parsed.scac = value ? String(value).trim().toUpperCase() : undefined;
          break;
        case "origin":
          parsed.origin = value ? String(value).trim().toUpperCase() : undefined;
          break;
        case "destination":
          parsed.destination = value ? String(value).trim().toUpperCase() : undefined;
          break;
        case "equipment":
          parsed.equipment = value ? normalizeEquipment(String(value)) : undefined;
          break;
        case "currency":
          parsed.currency = value ? String(value).trim().toUpperCase() : "USD";
          break;
        case "oceanFreight":
          parsed.oceanFreight = parseNumber(value);
          break;
        case "thc":
          parsed.thc = parseNumber(value);
          break;
        case "doc":
          parsed.doc = parseNumber(value);
          break;
        case "baf":
          parsed.baf = parseNumber(value);
          break;
        case "isps":
          parsed.isps = parseNumber(value);
          break;
        case "validFrom":
          parsed.validFrom = parseDate(value);
          break;
        case "validTo":
          parsed.validTo = parseDate(value);
          break;
        case "transitDays":
          parsed.transitDays = parseNumber(value);
          break;
        case "service":
          parsed.service = value ? String(value).trim() : undefined;
          break;
        case "rateType":
          parsed.rateType = value ? String(value).trim().toLowerCase() : undefined;
          break;
        case "via":
          parsed.via = value ? String(value).trim() : undefined;
          break;
      }
    }

    return parsed;
  }

  private toNormalizedRate(
    parsed: ParsedRow,
    carrierLookup: Map<string, { name: string; scac: string }>,
    filename: string
  ): NormalizedRate | null {
    // Validate required fields
    if (!parsed.carrier || !parsed.origin || !parsed.destination || !parsed.equipment) {
      return null;
    }

    // Look up carrier for SCAC
    const carrierRef = carrierLookup.get(parsed.carrier.toLowerCase());
    const carrier = {
      name: carrierRef?.name || parsed.carrier,
      scac: parsed.scac || carrierRef?.scac,
    };

    // Build charges array
    const charges = [];
    if (parsed.oceanFreight !== undefined) {
      charges.push({
        code: "OFR",
        description: "Ocean Freight",
        basis: "per_container" as const,
        amount: parsed.oceanFreight,
      });
    }
    if (parsed.thc !== undefined) {
      charges.push({
        code: "THC",
        description: "Terminal Handling Charge",
        basis: "per_container" as const,
        amount: parsed.thc,
      });
    }
    if (parsed.doc !== undefined) {
      charges.push({
        code: "DOC",
        description: "Documentation Fee",
        basis: "per_bl" as const,
        amount: parsed.doc,
      });
    }
    if (parsed.baf !== undefined) {
      charges.push({
        code: "BAF",
        description: "Bunker Adjustment Factor",
        basis: "per_container" as const,
        amount: parsed.baf,
      });
    }
    if (parsed.isps !== undefined) {
      charges.push({
        code: "ISPS",
        description: "ISPS Security Charge",
        basis: "per_container" as const,
        amount: parsed.isps,
      });
    }

    // If no charges found, can't create a valid rate
    if (charges.length === 0) {
      return null;
    }

    // Default dates if not provided
    const now = new Date();
    const validFrom = parsed.validFrom || now;
    const validTo = parsed.validTo || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days default

    // Normalize rate type
    let rateType: "spot" | "contract" | "tariff" | "market" = "spot";
    if (parsed.rateType) {
      const rt = parsed.rateType.toLowerCase();
      if (rt.includes("contract")) rateType = "contract";
      else if (rt.includes("tariff")) rateType = "tariff";
      else if (rt.includes("market")) rateType = "market";
    }

    return {
      source: "ratesheet",
      sourceRef: filename,
      rateType,
      carrier,
      lane: {
        origin: parsed.origin,
        destination: parsed.destination,
        via: parsed.via ? parsed.via.split(/[,;]/).map((s) => s.trim()) : undefined,
      },
      equipment: parsed.equipment,
      currency: parsed.currency || "USD",
      charges,
      transitTimeDays: parsed.transitDays,
      service: parsed.service,
      validFrom,
      validTo,
      fetchedAt: now,
    };
  }
}

export const ratesheetConnector = new RatesheetConnector();
