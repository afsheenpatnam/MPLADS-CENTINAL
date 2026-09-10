import { Schema, model, Document, Types } from "mongoose";

export type ConditionOperator = ">" | "<" | ">=" | "<=" | "==" | "!=";
export type ConditionCategory =
  | "TIME_PROGRESS"
  | "FINANCIAL"
  | "WORK_EVIDENCE"
  | "QUANTITY"
  | "VISIT"
  | "QUALITY"
  | "OTHER";

export interface ICondition extends Document {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  ruleId: string;
  category: ConditionCategory;
  parameter: string;
  operator: ConditionOperator;
  expectedValue: number | string;
  threshold?: number;
  severity: "LOW" | "MEDIUM" | "HIGH";
  enabled: boolean;
  source: string;
  configurable: boolean;
  createdAt: Date;
}

const ConditionSchema = new Schema<ICondition>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  ruleId: { type: String, required: true },
  category: {
    type: String,
    enum: ["TIME_PROGRESS", "FINANCIAL", "WORK_EVIDENCE", "QUANTITY", "VISIT", "QUALITY", "OTHER"],
    required: true,
  },
  parameter: { type: String, required: true },
  operator: { type: String, enum: [">", "<", ">=", "<=", "==", "!="], required: true },
  expectedValue: { type: Schema.Types.Mixed, required: true },
  threshold: { type: Number },
  severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
  enabled: { type: Boolean, default: true },
  source: { type: String, default: "conditions-file" },
  configurable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export const Condition = model<ICondition>("Condition", ConditionSchema);
