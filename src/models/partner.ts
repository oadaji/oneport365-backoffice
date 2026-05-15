import mongoose, { Schema, Document } from "mongoose";

export interface IPartner extends Document {
  name: string;
  email: string;
  categories: string[];
  tradelanes: string[];
  notes?: string;
  active: boolean;
  createdAt: Date;
}

const partnerSchema = new Schema<IPartner>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    categories: { type: [String], default: [] },
    tradelanes: { type: [String], default: [] },
    notes: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Partner = mongoose.model<IPartner>("Partner", partnerSchema);
