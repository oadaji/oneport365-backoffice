import mongoose, { Schema, Document, Types } from "mongoose";

export type ActivityType = "note" | "call" | "meeting" | "email" | "whatsapp" | "status_change";

export interface IActivity extends Document {
  companyId?: Types.ObjectId;
  contactId?: Types.ObjectId;
  opportunityId?: Types.ObjectId;
  type: ActivityType;
  summary: string;
  body?: string;
  user?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company" },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact" },
    opportunityId: { type: Schema.Types.ObjectId, ref: "Opportunity" },
    type: {
      type: String,
      required: true,
      enum: ["note", "call", "meeting", "email", "whatsapp", "status_change"],
    },
    summary: { type: String, required: true },
    body: String,
    user: String,
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Indexes for common queries
activitySchema.index({ companyId: 1, createdAt: -1 });
activitySchema.index({ contactId: 1, createdAt: -1 });
activitySchema.index({ opportunityId: 1, createdAt: -1 });

export const Activity = mongoose.model<IActivity>("Activity", activitySchema);
