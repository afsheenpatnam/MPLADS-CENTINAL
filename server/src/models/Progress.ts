import { Schema, model, Document, Types } from "mongoose";

export interface IProgress extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  submittedBy: Types.ObjectId;
  date: Date;
  physicalProgress: number;
  reportedWork: string;
  reportedQuantity?: number;
  milestoneId?: Types.ObjectId;
  remarks?: string;
  supportingEvidence: Types.ObjectId[];
  createdAt: Date;
}

const ProgressSchema = new Schema<IProgress>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, required: true },
  physicalProgress: { type: Number, required: true },
  reportedWork: { type: String, required: true },
  reportedQuantity: { type: Number },
  milestoneId: { type: Schema.Types.ObjectId, ref: "Milestone" },
  remarks: { type: String },
  supportingEvidence: [{ type: Schema.Types.ObjectId, ref: "Evidence" }],
  createdAt: { type: Date, default: Date.now },
});

export const Progress = model<IProgress>("Progress", ProgressSchema);
