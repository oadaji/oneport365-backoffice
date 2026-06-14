import mongoose, { Schema, Document } from "mongoose";

/**
 * Carrier reference — for normalizing carrier names across sources
 */
export interface ICarrier extends Document {
  name: string;
  scac: string;           // Standard Carrier Alpha Code
  aliases: string[];      // alternative names from different sources
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const carrierSchema = new Schema<ICarrier>(
  {
    name: { type: String, required: true },
    scac: { type: String, required: true, unique: true },
    aliases: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

carrierSchema.index({ aliases: 1 });
carrierSchema.index({ name: "text", aliases: "text" });

export const Carrier = mongoose.model<ICarrier>("Carrier", carrierSchema);

/**
 * Port reference — UN/LOCODE lookup
 */
export interface IPort extends Document {
  code: string;           // UN/LOCODE e.g. NGAPP
  name: string;           // e.g. Apapa
  city?: string;
  country: string;        // ISO 3166-1 alpha-2
  countryName: string;
  type: "ocean" | "air" | "both";
  aliases: string[];      // alternative names
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const portSchema = new Schema<IPort>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    city: String,
    country: { type: String, required: true },
    countryName: { type: String, required: true },
    type: { type: String, required: true, enum: ["ocean", "air", "both"] },
    aliases: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

portSchema.index({ country: 1 });
portSchema.index({ name: "text", aliases: "text" });

export const Port = mongoose.model<IPort>("Port", portSchema);

/**
 * Container type reference — for normalizing equipment across sources
 */
export interface IContainerType extends Document {
  code: string;           // e.g. 20GP, 40HC
  description: string;    // e.g. "20ft General Purpose"
  aliases: string[];      // e.g. ["20DV", "20ST", "20'GP"]
  category: "dry" | "reefer" | "open_top" | "flat_rack" | "tank";
  teuFactor: number;      // 20ft = 1, 40ft = 2
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const containerTypeSchema = new Schema<IContainerType>(
  {
    code: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    aliases: { type: [String], default: [] },
    category: {
      type: String,
      required: true,
      enum: ["dry", "reefer", "open_top", "flat_rack", "tank"],
    },
    teuFactor: { type: Number, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

containerTypeSchema.index({ aliases: 1 });

export const ContainerType = mongoose.model<IContainerType>("ContainerType", containerTypeSchema);

/**
 * Charge code reference — for normalizing charge line items
 */
export interface IChargeCode extends Document {
  code: string;           // e.g. OFR, THC, DOC
  description: string;
  category: "freight" | "terminal" | "documentation" | "surcharge" | "other";
  aliases: string[];      // alternative codes from different sources
  defaultBasis: "per_container" | "per_bl" | "per_shipment" | "percentage";
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const chargeCodeSchema = new Schema<IChargeCode>(
  {
    code: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ["freight", "terminal", "documentation", "surcharge", "other"],
    },
    aliases: { type: [String], default: [] },
    defaultBasis: {
      type: String,
      required: true,
      enum: ["per_container", "per_bl", "per_shipment", "percentage"],
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

chargeCodeSchema.index({ aliases: 1 });

export const ChargeCode = mongoose.model<IChargeCode>("ChargeCode", chargeCodeSchema);
