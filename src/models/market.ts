import mongoose, { Schema } from "mongoose";

// Market Index Snapshots
const marketIndexSnapshotSchema = new Schema(
  {
    source: { type: String, required: true },
    tradeLane: { type: String, required: true },
    polRegion: String,
    podRegion: String,
    equipType: { type: String, default: "40ft" },
    rateUsd: Number,
    wowChangePct: Number,
    momChangePct: Number,
    weekDate: Date,
    rawData: { type: Schema.Types.Mixed, default: {} },
    scrapedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const MarketIndexSnapshot = mongoose.model("MarketIndexSnapshot", marketIndexSnapshotSchema);

// Rate Benchmarks
const rateBenchmarkSchema = new Schema(
  {
    laneName: { type: String, required: true },
    polRegion: { type: String, required: true },
    podRegion: { type: String, required: true },
    equipType: { type: String, default: "40ft" },
    rate20ft: Number,
    rate40ft: Number,
    waAdjustmentPct: { type: Number, default: 0 },
    validFrom: Date,
    source: String,
    notes: String,
  },
  { timestamps: true }
);

export const RateBenchmark = mongoose.model("RateBenchmark", rateBenchmarkSchema);

// Partner Outreach
const partnerOutreachSchema = new Schema(
  {
    partnerIds: { type: [Schema.Types.Mixed], default: [] },
    partnerNames: { type: [Schema.Types.Mixed], default: [] },
    partnerEmails: { type: [Schema.Types.Mixed], default: [] },
    routes: { type: [Schema.Types.Mixed], default: [] },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    status: { type: String, default: "sent" },
    responseNotes: String,
    respondedAt: Date,
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const PartnerOutreach = mongoose.model("PartnerOutreach", partnerOutreachSchema);

// App Settings
const appSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: String,
    label: String,
  },
  { timestamps: true }
);

export const AppSetting = mongoose.model("AppSetting", appSettingSchema);
