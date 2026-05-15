import mongoose, { Schema, Document, Types } from "mongoose";

export interface IContact extends Document {
  companyId?: Types.ObjectId;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsappPhone?: string;
  jobTitle?: string;
  role: "contact" | "decision_maker" | "operations" | "finance";
  isPrimary: boolean;
  source: "email" | "whatsapp" | "manual";
  notes?: string;
  tags: string[];
  lastContactedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company" },
    firstName: { type: String, required: true },
    lastName: String,
    email: { type: String, unique: true, sparse: true },
    phone: String,
    whatsappPhone: String,
    jobTitle: String,
    role: { type: String, default: "contact", enum: ["contact", "decision_maker", "operations", "finance"] },
    isPrimary: { type: Boolean, default: false },
    source: { type: String, default: "email", enum: ["email", "whatsapp", "manual"] },
    notes: String,
    tags: { type: [String], default: [] },
    lastContactedAt: Date,
  },
  { timestamps: true }
);

export const Contact = mongoose.model<IContact>("Contact", contactSchema);
