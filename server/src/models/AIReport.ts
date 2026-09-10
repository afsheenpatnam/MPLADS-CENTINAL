import { Schema, model, Document, Types } from "mongoose";

export interface IAIReport extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;

  riskScore: number;
  riskLevel: string;

  executiveSummary: string;
  keyFindings: string[];
  financialObservations: string[];
  progressObservations: string[];
  evidenceObservations: string[];
  possibleConcerns: string[];
  recommendedActions: string[];
  questionsForContractor: string[];

  modelName: string;
  status: "GENERATED" | "UNAVAILABLE";
  generatedAt: Date;
}

const AIReportSchema = new Schema<IAIReport>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },

  riskScore: { type: Number, required: true },
  riskLevel: { type: String, required: true },

  executiveSummary: { type: String, default: "" },
  keyFindings: [{ type: String }],
  financialObservations: [{ type: String }],
  progressObservations: [{ type: String }],
  evidenceObservations: [{ type: String }],
  possibleConcerns: [{ type: String }],
  recommendedActions: [{ type: String }],
  questionsForContractor: [{ type: String }],

  modelName: { type: String, default: "" },
  status: { type: String, enum: ["GENERATED", "UNAVAILABLE"], default: "GENERATED" },
  generatedAt: { type: Date, default: Date.now },
});

AIReportSchema.index({ projectId: 1, generatedAt: -1 });

export const AIReport = model<IAIReport>("AIReport", AIReportSchema);
