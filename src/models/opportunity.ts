import mongoose, { Schema, Document, Types } from "mongoose";

export type OpportunityStage = "new-lead" | "qualified" | "proposal-sent" | "negotiation" | "closed-won" | "closed-lost";
export type OpportunitySource = "email" | "whatsapp" | "web" | "manual" | "rfq-auto";
export type Currency = "USD" | "NGN" | "GHS" | "KES";

// Stage to probability mapping
export const STAGE_PROBABILITY: Record<OpportunityStage, number> = {
  "new-lead": 20,
  "qualified": 40,
  "proposal-sent": 60,
  "negotiation": 75,
  "closed-won": 100,
  "closed-lost": 0,
};

export interface IOpportunity extends Document {
  companyId: Types.ObjectId;
  contactId?: Types.ObjectId;
  title: string;
  value: number;
  currency: Currency;
  stage: OpportunityStage;
  probability: number;
  expectedCloseDate?: Date;
  ownerId?: Types.ObjectId;
  source: OpportunitySource;
  linkedRfqIds: Types.ObjectId[];
  freightMode?: string;
  route?: string;
  closeReason?: string;
  notes?: string;
  wonAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const opportunitySchema = new Schema<IOpportunity>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact" },
    title: { type: String, required: true },
    value: { type: Number, required: true, default: 0 },
    currency: { type: String, default: "USD", enum: ["USD", "NGN", "GHS", "KES"] },
    stage: {
      type: String,
      default: "new-lead",
      enum: ["new-lead", "qualified", "proposal-sent", "negotiation", "closed-won", "closed-lost"]
    },
    probability: { type: Number, default: 20, min: 0, max: 100 },
    expectedCloseDate: Date,
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    source: {
      type: String,
      default: "manual",
      enum: ["email", "whatsapp", "web", "manual", "rfq-auto"]
    },
    linkedRfqIds: [{ type: Schema.Types.ObjectId, ref: "Rfq" }],
    freightMode: String,
    route: String,
    closeReason: String,
    notes: String,
    wonAt: Date,
  },
  { timestamps: true }
);

// Indexes for common queries
opportunitySchema.index({ companyId: 1 });
opportunitySchema.index({ ownerId: 1 });
opportunitySchema.index({ stage: 1 });
opportunitySchema.index({ createdAt: -1 });

// Pre-save hook to auto-set probability based on stage
opportunitySchema.pre("save", function() {
  if (this.isModified("stage")) {
    this.probability = STAGE_PROBABILITY[this.stage];
    if (this.stage === "closed-won" && !this.wonAt) {
      this.wonAt = new Date();
    }
  }
});

export const Opportunity = mongoose.model<IOpportunity>("Opportunity", opportunitySchema);
