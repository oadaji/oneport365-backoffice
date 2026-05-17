import mongoose, { Schema, Document } from "mongoose";

export interface IEmailAccount extends Document {
  label?: string;
  email: string;
  provider: "gmail" | "outlook" | "imap";
  imapHost?: string;
  imapPort?: number;
  password: string;
  active: boolean;
  lastSyncedAt?: Date;
  lastError?: string;
  authType: "password" | "oauth2";
  shared: boolean;
  refreshToken?: string;
  accessToken?: string;
  tokenExpiresAt?: Date;
  cursor?: string; // gmail: lastHistoryId | outlook: deltaLink
  createdAt: Date;
}

const emailAccountSchema = new Schema<IEmailAccount>(
  {
    label: String,
    email: { type: String, required: true, unique: true },
    provider: { type: String, default: "gmail", enum: ["gmail", "outlook", "imap"] },
    imapHost: String,
    imapPort: Number,
    password: { type: String, default: "" },
    active: { type: Boolean, default: true },
    lastSyncedAt: Date,
    lastError: String,
    shared: { type: Boolean, default: false },
    authType: { type: String, default: "password", enum: ["password", "oauth2"] },
    refreshToken: String,
    accessToken: String,
    tokenExpiresAt: Date,
    cursor: String,
  },
  { timestamps: true }
);

export const EmailAccount = mongoose.model<IEmailAccount>("EmailAccount", emailAccountSchema);
