import mongoose, { Schema, Document } from "mongoose";

export interface ICompany extends Document {
  name: string;
  domain?: string;
  industry?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  website?: string;
  tradeCorridors: string[];
  cargoTypes: string[];
  notes?: string;
  tags: string[];
  status: "active" | "inactive" | "lead";
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true },
    domain: { type: String, unique: true, sparse: true },
    industry: String,
    address: String,
    city: String,
    state: String,
    country: String,
    phone: String,
    website: String,
    tradeCorridors: { type: [String], default: [] },
    cargoTypes: { type: [String], default: [] },
    notes: String,
    tags: { type: [String], default: [] },
    status: { type: String, default: "active", enum: ["active", "inactive", "lead"] },
  },
  { timestamps: true }
);

export const Company = mongoose.model<ICompany>("Company", companySchema);
