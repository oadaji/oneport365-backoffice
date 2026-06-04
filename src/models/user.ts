import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  role: "sales" | "ops" | "finance" | "admin";
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, default: "sales", enum: ["sales", "ops", "finance", "admin"] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
