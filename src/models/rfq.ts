import mongoose, { Schema, Document, Types } from "mongoose";

export interface IRfqField {
  k: string;
  v: string;
  ok: boolean;
}

export interface IRfq extends Document {
  emailId?: Types.ObjectId;
  ref: string;
  emailType: string;
  status: "new" | "info_needed" | "ready" | "replied" | "partial" | "stuck" | "archived";
  fields: IRfqField[];
  missingFields: string[];
  followUpDraft?: string;
  notes?: string;
  groupId?: string;
  groupIndex?: number;
  groupTotal?: number;
  sourceMessageId?: string;
  companyId?: Types.ObjectId;
  contactId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const rfqSchema = new Schema<IRfq>(
  {
    emailId: { type: Schema.Types.ObjectId, ref: "Email" },
    ref: { type: String, required: true },
    emailType: { type: String, default: "customer-rfq" },
    status: { type: String, default: "info_needed", enum: ["new", "info_needed", "ready", "replied", "partial", "stuck", "archived"] },
    fields: { type: Schema.Types.Mixed, default: [] },
    missingFields: { type: Schema.Types.Mixed, default: [] },
    followUpDraft: String,
    notes: String,
    groupId: String,
    groupIndex: Number,
    groupTotal: Number,
    sourceMessageId: String,
    companyId: { type: Schema.Types.ObjectId, ref: "Company" },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact" },
  },
  { timestamps: true }
);

rfqSchema.index({ status: 1 });
rfqSchema.index({ emailId: 1 });
rfqSchema.index({ companyId: 1 });
rfqSchema.index({ contactId: 1 });

export const Rfq = mongoose.model<IRfq>("Rfq", rfqSchema);
