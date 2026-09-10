import { Schema, model, Document, Types } from "mongoose";

export interface IExceptionRequest extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  conditionId?: Types.ObjectId;
  ruleId?: string;
  reason: string;
  requestedAdjustment: number;
  supportingDocuments: Types.ObjectId[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedBy?: Types.ObjectId;
  reviewComment?: string;
  createdAt: Date;
  reviewedAt?: Date;
}

const ExceptionRequestSchema = new Schema<IExceptionRequest>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  conditionId: { type: Schema.Types.ObjectId, ref: "Condition" },
  ruleId: { type: String },
  reason: { type: String, required: true },
  requestedAdjustment: { type: Number, default: 0 },
  supportingDocuments: [{ type: Schema.Types.ObjectId, ref: "ProjectDocument" }],
  status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  reviewComment: { type: String },
  createdAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
});

export const ExceptionRequest = model<IExceptionRequest>("ExceptionRequest", ExceptionRequestSchema);
