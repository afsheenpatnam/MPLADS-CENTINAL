import { Schema, model, Document, Types } from "mongoose";

export interface IClarification extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  findingIds: Types.ObjectId[];
  requestedBy: Types.ObjectId;
  message: string;
  requiredDocuments: string[];
  deadline?: Date;
  response?: string;
  responseDocumentIds: Types.ObjectId[];
  respondedBy?: Types.ObjectId;
  status: "PENDING" | "RESPONDED" | "ACCEPTED" | "NEEDS_MORE_INFO" | "CLOSED";
  createdAt: Date;
  respondedAt?: Date;
}

const ClarificationSchema = new Schema<IClarification>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  findingIds: [{ type: Schema.Types.ObjectId, ref: "Finding" }],
  requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true },
  requiredDocuments: [{ type: String }],
  deadline: { type: Date },
  response: { type: String },
  responseDocumentIds: [{ type: Schema.Types.ObjectId, ref: "ProjectDocument" }],
  respondedBy: { type: Schema.Types.ObjectId, ref: "User" },
  status: {
    type: String,
    enum: ["PENDING", "RESPONDED", "ACCEPTED", "NEEDS_MORE_INFO", "CLOSED"],
    default: "PENDING",
  },
  createdAt: { type: Date, default: Date.now },
  respondedAt: { type: Date },
});

export const Clarification = model<IClarification>("Clarification", ClarificationSchema);
