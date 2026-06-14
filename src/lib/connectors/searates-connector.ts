import {
  RateConnector,
  ConnectorInput,
  ConnectorResult,
  NormalizedRate,
  ApiConnectorInput,
  ApiConnectorConfig,
} from "./types";

/**
 * SeaRates API response types (based on documented structure)
 * TODO: Verify against actual SeaRates API docs when implementing live HTTP
 */
export interface SeaRatesQuote {
  id: string;
  carrier: {
    name: string;
    scac?: string;
    logo?: string;
  };
  origin: {
    port: string;
    country: string;
    locode: string;
  };
  destination: {
    port: string;
    country: string;
    locode: string;
  };
  container_type: string;
  charges: SeaRatesCharge[];
  transit_time?: number;
  valid_from: string;
  valid_to: string;
  service_name?: string;
  transshipment_ports?: string[];
}

export interface SeaRatesCharge {
  name: string;
  code?: string;
  amount: number;
  currency: string;
  basis: string; // "PER_CONTAINER", "PER_BL", etc.
}

export interface SeaRatesApiResponse {
  success: boolean;
  data: {
    quotes: SeaRatesQuote[];
  };
  error?: string;
}

/**
 * Normalize SeaRates charge basis to our standard
 */
function normalizeBasis(basis: string): "per_container" | "per_bl" | "per_shipment" | "percentage" {
  const upper = basis.toUpperCase();
  if (upper.includes("CONTAINER") || upper.includes("UNIT")) return "per_container";
  if (upper.includes("BL") || upper.includes("DOCUMENT")) return "per_bl";
  if (upper.includes("SHIPMENT")) return "per_shipment";
  if (upper.includes("PERCENT")) return "percentage";
  return "per_container"; // default
}

/**
 * Normalize SeaRates equipment type to our standard
 */
function normalizeEquipment(containerType: string): string {
  const mapping: Record<string, string> = {
    "20GP": "20GP",
    "20DV": "20GP",
    "20'GP": "20GP",
    "40GP": "40GP",
    "40DV": "40GP",
    "40'GP": "40GP",
    "40HC": "40HC",
    "40HQ": "40HC",
    "40'HC": "40HC",
    "20RF": "20RF",
    "20'RF": "20RF",
    "40RF": "40RF",
    "40'RF": "40RF",
    "40RH": "40RF",
  };
  return mapping[containerType.toUpperCase()] || containerType.toUpperCase();
}

/**
 * Normalize charge code
 */
function normalizeChargeCode(name: string, code?: string): string {
  if (code) return code.toUpperCase();

  const lower = name.toLowerCase();
  if (lower.includes("ocean freight") || lower.includes("base freight")) return "OFR";
  if (lower.includes("terminal") || lower.includes("thc")) return "THC";
  if (lower.includes("document") || lower.includes("doc")) return "DOC";
  if (lower.includes("bunker") || lower.includes("baf")) return "BAF";
  if (lower.includes("security") || lower.includes("isps")) return "ISPS";
  if (lower.includes("seal")) return "SEAL";
  if (lower.includes("ams") || lower.includes("ens")) return "AMS";

  return name.substring(0, 10).toUpperCase().replace(/\s+/g, "_");
}

/**
 * Convert SeaRates quote to our normalized rate
 */
export function normalizeSeaRatesQuote(quote: SeaRatesQuote): NormalizedRate {
  const charges = quote.charges.map((c) => ({
    code: normalizeChargeCode(c.name, c.code),
    description: c.name,
    basis: normalizeBasis(c.basis),
    amount: c.amount,
  }));

  return {
    source: "searates",
    sourceRef: quote.id,
    rateType: "spot",
    carrier: {
      name: quote.carrier.name,
      scac: quote.carrier.scac,
    },
    lane: {
      origin: quote.origin.locode,
      destination: quote.destination.locode,
      via: quote.transshipment_ports,
    },
    equipment: normalizeEquipment(quote.container_type),
    currency: quote.charges[0]?.currency || "USD",
    charges,
    transitTimeDays: quote.transit_time,
    service: quote.service_name,
    validFrom: new Date(quote.valid_from),
    validTo: new Date(quote.valid_to),
    fetchedAt: new Date(),
    raw: quote,
  };
}

/**
 * SeaRates connector — fetches rates from SeaRates API
 *
 * Phase 1: Stub implementation with fixture-based normalization
 * Phase 2: Add live HTTP adapter with SeaRates API
 */
export class SeaRatesConnector implements RateConnector {
  readonly source = "searates" as const;
  readonly name = "SeaRates";

  private config: ApiConnectorConfig;

  constructor(config?: ApiConnectorConfig) {
    this.config = {
      apiKey: config?.apiKey || process.env.SEARATES_API_KEY,
      baseUrl: config?.baseUrl || "https://api.searates.com/v3",
      timeout: config?.timeout || 30000,
    };
  }

  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  async fetchRates(input: ConnectorInput): Promise<ConnectorResult> {
    if (input.type !== "api") {
      return {
        success: false,
        rates: [],
        errors: ["SeaRatesConnector requires API input"],
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        rates: [],
        errors: ["SeaRates API key not configured. Set SEARATES_API_KEY environment variable."],
      };
    }

    return this.fetchFromApi(input);
  }

  /**
   * Fetch rates from SeaRates API
   * TODO: Implement actual HTTP calls when ready for Phase 2
   */
  private async fetchFromApi(input: ApiConnectorInput): Promise<ConnectorResult> {
    // Phase 1: Return empty result with warning
    // Phase 2: Implement actual HTTP calls
    return {
      success: true,
      rates: [],
      warnings: [
        "SeaRates live API not yet implemented. Use fetchFromFixture() for testing normalization.",
        `Would query lanes: ${input.lanes.map((l) => `${l.origin}->${l.destination}`).join(", ")}`,
        `Equipment: ${input.equipment.join(", ")}`,
      ],
    };
  }

  /**
   * Fetch rates from fixture data (for testing normalization)
   */
  async fetchFromFixture(fixtureData: SeaRatesApiResponse): Promise<ConnectorResult> {
    if (!fixtureData.success || !fixtureData.data?.quotes) {
      return {
        success: false,
        rates: [],
        errors: [fixtureData.error || "Invalid fixture data"],
      };
    }

    const rates: NormalizedRate[] = [];
    const errors: string[] = [];

    for (const quote of fixtureData.data.quotes) {
      try {
        const normalized = normalizeSeaRatesQuote(quote);
        rates.push(normalized);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to normalize quote ${quote.id}: ${msg}`);
      }
    }

    return {
      success: errors.length === 0,
      rates,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

export const searatesConnector = new SeaRatesConnector();

/**
 * Sample fixture for testing (matches SeaRates API structure)
 */
export const SEARATES_SAMPLE_FIXTURE: SeaRatesApiResponse = {
  success: true,
  data: {
    quotes: [
      {
        id: "sr-12345",
        carrier: {
          name: "Maersk Line",
          scac: "MAEU",
          logo: "https://example.com/maersk.png",
        },
        origin: {
          port: "Shanghai",
          country: "CN",
          locode: "CNSHA",
        },
        destination: {
          port: "Apapa",
          country: "NG",
          locode: "NGAPP",
        },
        container_type: "40HC",
        charges: [
          {
            name: "Ocean Freight",
            code: "OFR",
            amount: 2500,
            currency: "USD",
            basis: "PER_CONTAINER",
          },
          {
            name: "Terminal Handling - Origin",
            code: "THC",
            amount: 150,
            currency: "USD",
            basis: "PER_CONTAINER",
          },
          {
            name: "Documentation Fee",
            code: "DOC",
            amount: 75,
            currency: "USD",
            basis: "PER_BL",
          },
          {
            name: "Bunker Adjustment Factor",
            code: "BAF",
            amount: 350,
            currency: "USD",
            basis: "PER_CONTAINER",
          },
        ],
        transit_time: 35,
        valid_from: "2025-01-01",
        valid_to: "2025-03-31",
        service_name: "Asia-West Africa Express",
        transshipment_ports: ["SGSIN"],
      },
      {
        id: "sr-12346",
        carrier: {
          name: "MSC",
          scac: "MSCU",
        },
        origin: {
          port: "Shanghai",
          country: "CN",
          locode: "CNSHA",
        },
        destination: {
          port: "Apapa",
          country: "NG",
          locode: "NGAPP",
        },
        container_type: "40HC",
        charges: [
          {
            name: "Ocean Freight",
            amount: 2350,
            currency: "USD",
            basis: "PER_CONTAINER",
          },
          {
            name: "THC Origin",
            amount: 180,
            currency: "USD",
            basis: "PER_CONTAINER",
          },
        ],
        transit_time: 42,
        valid_from: "2025-01-15",
        valid_to: "2025-04-15",
      },
    ],
  },
};
