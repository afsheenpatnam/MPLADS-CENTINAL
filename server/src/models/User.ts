import { Schema, model, Document, Types } from "mongoose";

export type UserRole = "OFFICER" | "CONTRACTOR";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone?: string;
  department?: string;
  active: boolean;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["OFFICER", "CONTRACTOR"], required: true },
  phone: { type: String },
  department: { type: String },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export const User = model<IUser>("User", UserSchema);
