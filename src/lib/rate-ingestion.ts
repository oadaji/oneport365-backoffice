import { CanonicalRate, ICanonicalRate, ICharge } from "../models/canonical-rate";
import { NormalizedRate, computeDedupKey, ExpiryStatus, computeExpiryStatus, RateSource, RateType } from "./connectors/types";

/**
 * Result of an ingestion operation
 */
export interface IngestionResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Filter options for querying canonical rates
 */
export interface CanonicalRateFilters {
  source?: string;
  origin?: string;
  destination?: string;
  equipment?: string;
  carrier?: string;
  expiryStatus?: ExpiryStatus;
  includeArchived?: boolean;
}

/**
 * Canonical rate with computed expiry status (plain object, not Document)
 */
export interface CanonicalRateWithStatus {
  _id: string;
  source: RateSource;
  sourceRef?: string;
  rateType: RateType;
  carrier: { name: string; scac?: string };
  lane: { origin: string; destination: string; via?: string[] };
  equipment: string;
  currency: string;
  charges: ICharge[];
  transitTimeDays?: number;
  service?: string;
  validFrom: Date;
  validTo: Date;
  fetchedAt: Date;
  raw?: unknown;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiryStatus: ExpiryStatus;
  totalAmount: number;
}

/**
 * Upsert normalized rates into the CanonicalRate collection.
 * Uses natural key for deduplication: (source, carrier, origin, destination, equipment, validFrom)
 */
export async function upsertCanonicalRates(rates: NormalizedRate[]): Promise<IngestionResult> {
  const result: IngestionResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const rate of rates) {
    try {
      const filter = {
        source: rate.source,
        "carrier.name": rate.carrier.name,
        "lane.origin": rate.lane.origin,
        "lane.destination": rate.lane.destination,
        equipment: rate.equipment,
        validFrom: rate.validFrom,
      };

      // If we have SCAC, use it as more reliable identifier
      if (rate.carrier.scac) {
        Object.assign(filter, { "carrier.scac": rate.carrier.scac });
      }

      const existing = await CanonicalRate.findOne(filter);

      if (existing) {
        // Update existing rate
        await CanonicalRate.updateOne(filter, {
          $set: {
            sourceRef: rate.sourceRef,
            rateType: rate.rateType,
            carrier: rate.carrier,
            lane: rate.lane,
            currency: rate.currency,
            charges: rate.charges,
            transitTimeDays: rate.transitTimeDays,
            service: rate.service,
            validTo: rate.validTo,
            fetchedAt: rate.fetchedAt,
            raw: rate.raw,
            archived: false, // Re-fetched rates are unarchived
          },
        });
        result.updated++;
      } else {
        // Insert new rate
        await CanonicalRate.create({
          ...rate,
          archived: false,
        });
        result.inserted++;
      }
    } catch (err) {
      const dedupKey = computeDedupKey(rate);
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to upsert rate ${dedupKey}: ${message}`);
      result.skipped++;
    }
  }

  return result;
}

/**
 * Query canonical rates with filters and computed expiry status
 */
export async function queryCanonicalRates(
  filters: CanonicalRateFilters = {}
): Promise<CanonicalRateWithStatus[]> {
  const query: Record<string, unknown> = {};

  if (!filters.includeArchived) {
    query.archived = false;
  }

  if (filters.source) {
    query.source = filters.source;
  }

  if (filters.origin) {
    query["lane.origin"] = { $regex: filters.origin, $options: "i" };
  }

  if (filters.destination) {
    query["lane.destination"] = { $regex: filters.destination, $options: "i" };
  }

  if (filters.equipment) {
    query.equipment = filters.equipment;
  }

  if (filters.carrier) {
    query.$or = [
      { "carrier.name": { $regex: filters.carrier, $options: "i" } },
      { "carrier.scac": { $regex: filters.carrier, $options: "i" } },
    ];
  }

  const rates = await CanonicalRate.find(query).sort({ fetchedAt: -1 }).lean();

  // Add computed fields
  const ratesWithStatus: CanonicalRateWithStatus[] = rates.map((rate) => {
    const expiryStatus = computeExpiryStatus(rate.validTo);
    const totalAmount = rate.charges.reduce((sum, c) => sum + c.amount, 0);

    return {
      _id: String(rate._id),
      source: rate.source,
      sourceRef: rate.sourceRef,
      rateType: rate.rateType,
      carrier: rate.carrier,
      lane: rate.lane,
      equipment: rate.equipment,
      currency: rate.currency,
      charges: rate.charges,
      transitTimeDays: rate.transitTimeDays,
      service: rate.service,
      validFrom: rate.validFrom,
      validTo: rate.validTo,
      fetchedAt: rate.fetchedAt,
      raw: rate.raw,
      archived: rate.archived,
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt,
      expiryStatus,
      totalAmount,
    };
  });

  // Filter by expiry status if requested
  if (filters.expiryStatus) {
    return ratesWithStatus.filter((r) => r.expiryStatus === filters.expiryStatus);
  }

  return ratesWithStatus;
}

/**
 * Archive rates older than a given date
 */
export async function archiveExpiredRates(beforeDate?: Date): Promise<number> {
  const cutoff = beforeDate || new Date();

  const result = await CanonicalRate.updateMany(
    {
      validTo: { $lt: cutoff },
      archived: false,
    },
    { $set: { archived: true } }
  );

  return result.modifiedCount;
}

/**
 * Get rate counts by source
 */
export async function getRateCountsBySource(): Promise<Record<string, number>> {
  const pipeline = [
    { $match: { archived: false } },
    { $group: { _id: "$source", count: { $sum: 1 } } },
  ];

  const results = await CanonicalRate.aggregate(pipeline);

  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r._id] = r.count;
  }

  return counts;
}

/**
 * Delete all rates from a specific source (for re-import)
 */
export async function deleteRatesBySource(source: string): Promise<number> {
  const result = await CanonicalRate.deleteMany({ source: source as RateSource });
  return result.deletedCount;
}
