import { Schema, model, Document, Types } from "mongoose";

export type SanctionStatus = "PENDING_APPROVAL" | "APPROVED";

export interface ISanction extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;

  sanctionedAmount: number;
  duration: number; // months
  approvedWork: string;
  approvedQuantity: number;
  approvedMaterials: string;

  financialConditions: string[];
  timelineConditions: string[];
  workConditions: string[];
  evidenceConditions: string[];
  visitConditions: string[];
  otherConditions: string[];

  requiredVisits: number;
  reportingFrequencyDays: number;
  evidenceRequired: boolean;
  expenditureJustificationRequired: boolean;

  status: SanctionStatus;
  version: number;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;

  createdBy: Types.ObjectId;
  createdAt: Date;
}

const SanctionSchema = new Schema<ISanction>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, unique: true },

  sanctionedAmount: { type: Number, required: true },
  duration: { type: Number, required: true },
  approvedWork: { type: String, required: true },
  approvedQuantity: { type: Number, default: 0 },
  approvedMaterials: { type: String, default: "" },

  financialConditions: [{ type: String }],
  timelineConditions: [{ type: String }],
  workConditions: [{ type: String }],
  evidenceConditions: [{ type: String }],
  visitConditions: [{ type: String }],
  otherConditions: [{ type: String }],

  requiredVisits: { type: Number, default: 4 },
  reportingFrequencyDays: { type: Number, default: 7 },
  evidenceRequired: { type: Boolean, default: true },
  expenditureJustificationRequired: { type: Boolean, default: true },

  status: { type: String, enum: ["PENDING_APPROVAL", "APPROVED"], default: "PENDING_APPROVAL" },
  version: { type: Number, default: 1 },
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  approvedAt: { type: Date },

  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Sanction = model<ISanction>("Sanction", SanctionSchema);
