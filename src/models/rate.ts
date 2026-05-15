import mongoose, { Schema, Document, Types } from "mongoose";

export interface IOceanFreightRate extends Document {
  carrier: string;
  polCode: string;
  podCode: string;
  originCountry?: string;
  destCountry?: string;
  commodityType: string;
  equipmentType: string;
  rateType: string;
  inclusionType?: string;
  transitTime?: string;
  freeTime?: string;
  currency: string;
  amount20ft?: number;
  amount40ft?: number;
  amount40hc?: number;
  expiryDate: Date;
  partnerId?: Types.ObjectId;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const oceanFreightRateSchema = new Schema<IOceanFreightRate>(
  {
    carrier: { type: String, required: true },
    polCode: { type: String, required: true },
    podCode: { type: String, required: true },
    originCountry: String,
    destCountry: String,
    commodityType: { type: String, default: "general" },
    equipmentType: { type: String, default: "40ft" },
    rateType: { type: String, default: "all_in" },
    inclusionType: String,
    transitTime: String,
    freeTime: String,
    currency: { type: String, default: "USD" },
    amount20ft: Number,
    amount40ft: Number,
    amount40hc: Number,
    expiryDate: { type: Date, required: true },
    partnerId: { type: Schema.Types.ObjectId, ref: "Partner" },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

oceanFreightRateSchema.index({ archived: 1 });
oceanFreightRateSchema.index({ polCode: 1, podCode: 1 });

export const OceanFreightRate = mongoose.model<IOceanFreightRate>("OceanFreightRate", oceanFreightRateSchema);

// Haulage Import
const haulageImportRateSchema = new Schema(
  {
    terminalName: { type: String, required: true },
    portCode: { type: String, required: true },
    originState: String,
    destCity: String,
    destLga: { type: String, required: true },
    destState: String,
    shipmentType: { type: String, default: "fcl" },
    equipmentType: { type: String, default: "40ft" },
    commodityType: { type: String, default: "general" },
    currency: { type: String, default: "NGN" },
    price: { type: Number, required: true },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const HaulageImportRate = mongoose.model("HaulageImportRate", haulageImportRateSchema);

// Haulage Export
const haulageExportRateSchema = new Schema(
  {
    terminalName: { type: String, required: true },
    portCode: { type: String, required: true },
    originState: { type: String, required: true },
    originCity: String,
    originLga: { type: String, required: true },
    destState: String,
    shipmentType: { type: String, default: "fcl" },
    equipmentType: { type: String, default: "40ft" },
    commodityType: { type: String, default: "general" },
    currency: { type: String, default: "NGN" },
    price: { type: Number, required: true },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const HaulageExportRate = mongoose.model("HaulageExportRate", haulageExportRateSchema);

// Other Charges
const otherChargeSchema = new Schema(
  {
    itemName: { type: String, required: true },
    shipmentType: { type: String, default: "both" },
    itemCategory: { type: String, required: true },
    commodityType: { type: String, default: "FAK" },
    country: String,
    currency: { type: String, default: "NGN" },
    price: Number,
    asPerReceipt: { type: Boolean, default: false },
    expiryDate: Date,
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const OtherCharge = mongoose.model("OtherCharge", otherChargeSchema);
