import { Schema, model, Document, Types } from "mongoose";

export interface IRiskFactor {
  category: string;
  weight: number;
  contribution: number;
  findingCount: number;
}

export interface IRiskAssessment extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;

  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

  riskFactors: IRiskFactor[];

  ruleScore: number;
  mlScore: number;
  cvScore: number;
  financialScore: number;
  progressScore: number;
  evidenceScore: number;
  contractorScore: number;

  modelVersion: string;
  // Raw ML feature vector + explanation, persisted so the Officer's ML Analysis view can
  // render "why the model flagged this" without needing to re-run detection.
  mlFeatures: Record<string, number>;
  mlNormalizedScore: number;
  mlDominantSignals: { feature: string; value: number; zScore: number }[];
  createdAt: Date;
}

const RiskFactorSchema = new Schema<IRiskFactor>(
  {
    category: { type: String, required: true },
    weight: { type: Number, required: true },
    contribution: { type: Number, required: true },
    findingCount: { type: Number, required: true },
  },
  { _id: false }
);

const RiskAssessmentSchema = new Schema<IRiskAssessment>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },

  score: { type: Number, required: true },
  level: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], required: true },
  priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], required: true },

  riskFactors: [RiskFactorSchema],

  ruleScore: { type: Number, default: 0 },
  mlScore: { type: Number, default: 0 },
  cvScore: { type: Number, default: 0 },
  financialScore: { type: Number, default: 0 },
  progressScore: { type: Number, default: 0 },
  evidenceScore: { type: Number, default: 0 },
  contractorScore: { type: Number, default: 0 },

  modelVersion: { type: String, default: "1.0.0" },
  mlFeatures: { type: Schema.Types.Mixed, default: {} },
  mlNormalizedScore: { type: Number, default: 0 },
  mlDominantSignals: { type: Schema.Types.Mixed, default: [] },
  createdAt: { type: Date, default: Date.now },
});

RiskAssessmentSchema.index({ projectId: 1, createdAt: -1 });

export const RiskAssessment = model<IRiskAssessment>("RiskAssessment", RiskAssessmentSchema);
