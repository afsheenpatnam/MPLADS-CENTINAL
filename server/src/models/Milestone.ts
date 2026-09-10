import { Schema, model, Document, Types } from "mongoose";

export interface IMilestone extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  name: string;
  expectedDate: Date;
  expectedProgress: number;
  actualProgress: number;
  status: "PENDING" | "ON_TRACK" | "DELAYED" | "COMPLETED";
  createdAt: Date;
}

const MilestoneSchema = new Schema<IMilestone>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  name: { type: String, required: true },
  expectedDate: { type: Date, required: true },
  expectedProgress: { type: Number, required: true },
  actualProgress: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["PENDING", "ON_TRACK", "DELAYED", "COMPLETED"],
    default: "PENDING",
  },
  createdAt: { type: Date, default: Date.now },
});

export const Milestone = model<IMilestone>("Milestone", MilestoneSchema);
