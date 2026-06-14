import mongoose, { Schema, Document } from "mongoose";

/**
 * Charge line item with basis for calculation
 */
export interface ICharge {
  code: string;           // e.g. OFR, THC, DOC, BAF
  description: string;
  basis: "per_container" | "per_bl" | "per_shipment" | "percentage";
  amount: number;
  appliesTo?: string[];   // e.g. ["20GP", "40GP"] or undefined = all
}

/**
 * Canonical rate shape — normalized from all sources
 */
export interface ICanonicalRate extends Document {
  source: "manual" | "searates" | "maersk" | "freightify" | "ratesheet";
  sourceRef?: string;           // carrier price ID for booking
  rateType: "spot" | "contract" | "tariff" | "market";
  carrier: {
    name: string;
    scac?: string;
  };
  lane: {
    origin: string;             // UN/LOCODE e.g. CNSHA
    destination: string;        // UN/LOCODE e.g. NGAPP
    via?: string[];             // transshipment ports
  };
  equipment: string;            // 20GP, 40GP, 40HC, 40RF, etc.
  currency: string;
  charges: ICharge[];
  transitTimeDays?: number;
  service?: string;             // e.g. "Asia Express"
  validFrom: Date;
  validTo: Date;
  fetchedAt: Date;
  raw?: unknown;                // original payload for audit
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const chargeSchema = new Schema(
  {
    code: { type: String, required: true },
    description: { type: String, required: true },
    basis: {
      type: String,
      required: true,
      enum: ["per_container", "per_bl", "per_shipment", "percentage"],
    },
    amount: { type: Number, required: true },
    appliesTo: [String],
  },
  { _id: false }
);

const canonicalRateSchema = new Schema<ICanonicalRate>(
  {
    source: {
      type: String,
      required: true,
      enum: ["manual", "searates", "maersk", "freightify", "ratesheet"],
    },
    sourceRef: String,
    rateType: {
      type: String,
      required: true,
      enum: ["spot", "contract", "tariff", "market"],
    },
    carrier: {
      name: { type: String, required: true },
      scac: String,
    },
    lane: {
      origin: { type: String, required: true },
      destination: { type: String, required: true },
      via: [String],
    },
    equipment: { type: String, required: true },
    currency: { type: String, required: true, default: "USD" },
    charges: { type: [chargeSchema], required: true },
    transitTimeDays: Number,
    service: String,
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    fetchedAt: { type: Date, required: true },
    raw: Schema.Types.Mixed,
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Compound index for deduplication natural key
canonicalRateSchema.index(
  {
    source: 1,
    "carrier.scac": 1,
    "carrier.name": 1,
    "lane.origin": 1,
    "lane.destination": 1,
    equipment: 1,
    validFrom: 1,
  },
  { name: "dedup_natural_key" }
);

// Query indexes
canonicalRateSchema.index({ archived: 1 });
canonicalRateSchema.index({ "lane.origin": 1, "lane.destination": 1 });
canonicalRateSchema.index({ source: 1 });
canonicalRateSchema.index({ validTo: 1 });

export const CanonicalRate = mongoose.model<ICanonicalRate>("CanonicalRate", canonicalRateSchema);
