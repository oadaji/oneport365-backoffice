import mongoose, { Schema, Document } from "mongoose";

export type MarketCompanyCategory =
  | "Freight Forwarder"
  | "Importer / Shipper"
  | "Exporter"
  | "Haulage or Transport"
  | "Air Cargo or Express"
  | "Shipping Line"
  | "Logistics Company"
  | "Terminal or Port Operator"
  | "Trade Services"
  | "Other";

export interface IMarketCompany extends Document {
  category: MarketCompanyCategory;
  subCategory?: string;
  companyName: string;
  address?: string;
  city?: string;
  state?: string;
  services?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  notes?: string;
  tags?: string[];
  lastContactedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const marketCompanySchema = new Schema<IMarketCompany>(
  {
    category: {
      type: String,
      required: true,
      enum: [
        "Freight Forwarder",
        "Importer / Shipper",
        "Exporter",
        "Haulage or Transport",
        "Air Cargo or Express",
        "Shipping Line",
        "Logistics Company",
        "Terminal or Port Operator",
        "Trade Services",
        "Other",
      ],
    },
    subCategory: String,
    companyName: { type: String, required: true },
    address: String,
    city: String,
    state: String,
    services: String,
    contactEmail: String,
    contactPhone: String,
    website: String,
    notes: String,
    tags: [String],
    lastContactedAt: Date,
  },
  { timestamps: true }
);

// Indexes for common queries
marketCompanySchema.index({ category: 1 });
marketCompanySchema.index({ companyName: "text" });
marketCompanySchema.index({ state: 1 });
marketCompanySchema.index({ tags: 1 });

export const MarketCompany = mongoose.model<IMarketCompany>("MarketCompany", marketCompanySchema);
