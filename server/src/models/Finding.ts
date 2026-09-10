import { Schema, model, Document, Types } from "mongoose";

export type FindingClassification = "ANOMALY" | "FRAUD_RISK_INDICATOR" | "INEFFICIENCY";
export type FindingSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type FindingStatus = "OPEN" | "CLARIFICATION_REQUESTED" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
export type FindingSource = "RULE_ENGINE" | "ML_ENGINE" | "CV_ENGINE";

export interface IFinding extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;

  category: string;
  type: string;
  classification: FindingClassification;
  severity: FindingSeverity;
  confidence: number;

  title: string;
  description: string;

  expectedValue?: number | string;
  actualValue?: number | string;
  deviation?: number;

  ruleId?: string;
  source: FindingSource;

  evidenceIds: Types.ObjectId[];
  parametersUsed: Record<string, unknown>;

  recommendedAction: string;

  status: FindingStatus;

  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  resolutionNote?: string;
}

const FindingSchema = new Schema<IFinding>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },

  category: { type: String, required: true },
  type: { type: String, required: true },
  classification: {
    type: String,
    enum: ["ANOMALY", "FRAUD_RISK_INDICATOR", "INEFFICIENCY"],
    required: true,
  },
  severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },

  title: { type: String, required: true },
  description: { type: String, required: true },

  expectedValue: { type: Schema.Types.Mixed },
  actualValue: { type: Schema.Types.Mixed },
  deviation: { type: Number },

  ruleId: { type: String },
  source: { type: String, enum: ["RULE_ENGINE", "ML_ENGINE", "CV_ENGINE"], required: true },

  evidenceIds: [{ type: Schema.Types.ObjectId, ref: "Evidence" }],
  parametersUsed: { type: Schema.Types.Mixed, default: {} },

  recommendedAction: { type: String, default: "" },

  status: {
    type: String,
    enum: ["OPEN", "CLARIFICATION_REQUESTED", "UNDER_REVIEW", "RESOLVED", "DISMISSED"],
    default: "OPEN",
  },

  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
  resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  resolutionNote: { type: String },
});

FindingSchema.index({ projectId: 1, status: 1 });
FindingSchema.index({ severity: 1 });

export const Finding = model<IFinding>("Finding", FindingSchema);
