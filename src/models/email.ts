import mongoose, { Schema, Document, Types } from "mongoose";

export interface IEmail extends Document {
  uid: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  receivedAt: Date;
  emailType: string;
  messageId?: string;
  inReplyTo?: string;
  parentEmailId?: Types.ObjectId;
  cc?: string;
  receivedInbox?: string;
  source: "email" | "whatsapp";
  whatsappPhone?: string;
  extractionStatus?: "ok" | "failed" | "pending";
  extractionError?: string;
  contactId?: Types.ObjectId;
  createdAt: Date;
}

const emailSchema = new Schema<IEmail>(
  {
    uid: { type: String, required: true, unique: true },
    fromName: { type: String, required: true },
    fromEmail: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    bodyHtml: { type: String },
    receivedAt: { type: Date, default: Date.now },
    emailType: { type: String, default: "customer-rfq" },
    messageId: String,
    inReplyTo: String,
    parentEmailId: { type: Schema.Types.ObjectId, ref: "Email" },
    cc: String,
    receivedInbox: String,
    source: { type: String, default: "email", enum: ["email", "whatsapp"] },
    whatsappPhone: String,
    extractionStatus: { type: String, enum: ["ok", "failed", "pending"], default: "ok" },
    extractionError: String,
    contactId: { type: Schema.Types.ObjectId, ref: "Contact" },
  },
  { timestamps: true }
);

emailSchema.index({ fromEmail: 1, subject: 1 });
emailSchema.index({ messageId: 1 });

export const Email = mongoose.model<IEmail>("Email", emailSchema);
