import { Types } from "mongoose";
import { IProject } from "../../models/Project";
import { ISanction } from "../../models/Sanction";
import { ICondition } from "../../models/Condition";
import { IMilestone } from "../../models/Milestone";
import { IProgress } from "../../models/Progress";
import { IExpenditure } from "../../models/Expenditure";
import { ISiteVisit } from "../../models/SiteVisit";
import { IEvidence } from "../../models/Evidence";
import { IProjectDocument } from "../../models/Document";
import { IExceptionRequest } from "../../models/ExceptionRequest";

export interface DetectionContext {
  project: IProject;
  sanction: ISanction | null;
  conditions: ICondition[];
  milestones: IMilestone[];
  progress: IProgress[];
  expenditures: IExpenditure[];
  siteVisits: ISiteVisit[];
  evidence: IEvidence[];
  documents: IProjectDocument[];
  approvedExceptions: IExceptionRequest[];
  contractorStats: {
    contractorProjectCount: number;
    contractorAnomalyRate: number; // percent of contractor's other projects at HIGH/CRITICAL risk
  };
}

export interface DraftFinding {
  category: string;
  type: string;
  classification: "ANOMALY" | "FRAUD_RISK_INDICATOR" | "INEFFICIENCY";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  title: string;
  description: string;
  expectedValue?: number | string;
  actualValue?: number | string;
  deviation?: number;
  ruleId?: string;
  source: "RULE_ENGINE" | "ML_ENGINE" | "CV_ENGINE";
  evidenceIds: Types.ObjectId[];
  parametersUsed: Record<string, unknown>;
  recommendedAction: string;
}

export function elapsedPercent(startDate: Date, endDate: Date, at: Date = new Date()): number {
  const total = endDate.getTime() - startDate.getTime();
  if (total <= 0) return 100;
  const elapsed = at.getTime() - startDate.getTime();
  return Math.max(0, Math.min(150, (elapsed / total) * 100));
}
