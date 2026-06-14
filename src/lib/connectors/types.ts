import { ICharge } from "../../models/canonical-rate";

/**
 * Source types for rate ingestion
 */
export type RateSource = "manual" | "searates" | "maersk" | "freightify" | "ratesheet";

/**
 * Rate type classification
 */
export type RateType = "spot" | "contract" | "tariff" | "market";

/**
 * Lane definition for API queries
 */
export interface Lane {
  origin: string;       // UN/LOCODE
  destination: string;  // UN/LOCODE
}

/**
 * Input for API-based connectors
 */
export interface ApiConnectorInput {
  type: "api";
  lanes: Lane[];
  equipment: string[];  // e.g. ["20GP", "40GP", "40HC"]
}

/**
 * Input for file-based connectors
 */
export interface FileConnectorInput {
  type: "file";
  buffer: Buffer;
  filename: string;
  mimeType?: string;
}

/**
 * Union type for all connector inputs
 */
export type ConnectorInput = ApiConnectorInput | FileConnectorInput;

/**
 * Normalized rate shape returned by all connectors
 * This is the data shape before DB storage (no _id, timestamps handled by Mongoose)
 */
export interface NormalizedRate {
  source: RateSource;
  sourceRef?: string;
  rateType: RateType;
  carrier: {
    name: string;
    scac?: string;
  };
  lane: {
    origin: string;
    destination: string;
    via?: string[];
  };
  equipment: string;
  currency: string;
  charges: ICharge[];
  transitTimeDays?: number;
  service?: string;
  validFrom: Date;
  validTo: Date;
  fetchedAt: Date;
  raw?: unknown;
}

/**
 * Result from a connector fetch operation
 */
export interface ConnectorResult {
  success: boolean;
  rates: NormalizedRate[];
  errors?: string[];
  warnings?: string[];
}

/**
 * Connector interface — all connectors must implement this
 */
export interface RateConnector {
  /** Unique identifier for this connector */
  readonly source: RateSource;

  /** Human-readable name */
  readonly name: string;

  /** Fetch and normalize rates from the source */
  fetchRates(input: ConnectorInput): Promise<ConnectorResult>;

  /** Check if connector is properly configured (has API keys, etc.) */
  isConfigured(): boolean;
}

/**
 * Configuration for API-based connectors
 */
export interface ApiConnectorConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * Helper to compute dedup key for a rate
 */
export function computeDedupKey(rate: NormalizedRate): string {
  const carrierKey = rate.carrier.scac || rate.carrier.name;
  return [
    rate.source,
    carrierKey,
    rate.lane.origin,
    rate.lane.destination,
    rate.equipment,
    rate.validFrom.toISOString().split("T")[0], // date only
  ].join("|");
}

/**
 * Expiry status based on validTo date
 */
export type ExpiryStatus = "active" | "expiring_soon" | "expired";

/**
 * Compute expiry status for a rate
 * - active: validTo > 14 days from now
 * - expiring_soon: validTo within 14 days
 * - expired: validTo in the past
 */
export function computeExpiryStatus(validTo: Date): ExpiryStatus {
  const now = new Date();
  const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 14) return "expiring_soon";
  return "active";
}
