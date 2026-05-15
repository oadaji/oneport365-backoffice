import mongoose, { Schema, Document, Types } from "mongoose";

export interface IQuote extends Document {
  quoteRef: string;
  rfqId?: Types.ObjectId;
  rfqRef?: string;
  status: string;
  customerName?: string;
  companyName?: string;
  customerEmail?: string;
  pol?: string;
  pod?: string;
  polCode?: string;
  podCode?: string;
  commodity?: string;
  containerType?: string;
  containerQty: number;
  carrier?: string;
  oceanLine: Record<string, unknown>;
  oceanOptions: Record<string, unknown>[];
  originCharges: Record<string, unknown>[];
  destCharges: Record<string, unknown>[];
  availableCharges: Record<string, unknown>[];
  haulage?: Record<string, unknown>;
  hasSuggestedHaulage: boolean;
  exchangeRate: number;
  marginPct: number;
  totalCostUSD?: number;
  sellPriceUSD?: number;
  companyId?: Types.ObjectId;
  contactId?: Types.ObjectId;
  aiNotes?: string;
  notes?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const quoteSchema = new Schema<IQuote>(
  {
    quoteRef: { type: String, required: true },
    rfqId: { type: Schema.Types.ObjectId, ref: "Rfq" },
    rfqRef: String,
    status: { type: String, default: "draft" },
    customerName: String,
    companyName: String,
    customerEmail: String,
    pol: String,
    pod: String,
    polCode: String,
    podCode: String,
    commodity: String,
    containerType: String,
    containerQty: { type: Number, default: 1 },
    carrier: String,
    oceanLine: { type: Schema.Types.Mixed, default: {} },
    oceanOptions: { type: Schema.Types.Mixed, default: [] },
    originCharges: { type: Schema.Types.Mixed, default: [] },
    destCharges: { type: Schema.Types.Mixed, default: [] },
    availableCharges: { type: Schema.Types.Mixed, default: [] },
    haulage: Schema.Types.Mixed,
    hasSuggestedHaulage: { type: Boolean, default: false },
    exchangeRate: { type: Number, default: 1600 },
    marginPct: { type: Number, default: 13 },
    totalCostUSD: Number,
    sellPriceUSD: Number,
    companyId: { type: Schema.Types.ObjectId, ref: "Company" },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact" },
    aiNotes: String,
    notes: String,
    sentAt: Date,
  },
  { timestamps: true }
);

quoteSchema.index({ rfqId: 1 });

export const Quote = mongoose.model<IQuote>("Quote", quoteSchema);
