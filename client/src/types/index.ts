export type UserRole = "OFFICER" | "CONTRACTOR";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  department?: string;
  active: boolean;
  createdAt: string;
}

export interface Project {
  _id: string;
  projectCode: string;
  name: string;
  description: string;
  projectType: string;
  state: string;
  district: string;
  location: string;
  latitude: number;
  longitude: number;
  officerId: string | { _id: string; name: string; email: string };
  contractorId?: string | { _id: string; name: string; email: string; phone?: string };
  sanctionedAmount: number;
  releasedAmount: number;
  spentAmount: number;
  startDate: string;
  endDate: string;
  approvedWork: string;
  approvedQuantity: number;
  approvedMaterials: string;
  expectedProgress: number;
  actualProgress: number;
  status: "PLANNED" | "ACTIVE" | "DELAYED" | "COMPLETED" | "SUSPENDED";
  riskScore: number;
  riskLevel: RiskLevel;
  priority: RiskLevel;
  createdAt: string;
  updatedAt: string;
}

export interface Finding {
  _id: string;
  projectId: string;
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
  evidenceIds: string[];
  parametersUsed: Record<string, unknown>;
  recommendedAction: string;
  status: "OPEN" | "CLARIFICATION_REQUESTED" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface RiskFactor {
  category: string;
  weight: number;
  contribution: number;
  findingCount: number;
}

export interface RiskAssessment {
  _id: string;
  projectId: string;
  score: number;
  level: RiskLevel;
  priority: RiskLevel;
  riskFactors: RiskFactor[];
  ruleScore: number;
  mlScore: number;
  financialScore: number;
  progressScore: number;
  evidenceScore: number;
  contractorScore: number;
  modelVersion: string;
  mlFeatures: Record<string, number>;
  mlNormalizedScore: number;
  mlDominantSignals: { feature: string; value: number; zScore: number }[];
  createdAt: string;
}

export interface AIReport {
  _id: string;
  projectId: string;
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
  generatedAt: string;
}

export interface Sanction {
  _id: string;
  projectId: string;
  sanctionedAmount: number;
  duration: number;
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
  status: "PENDING_APPROVAL" | "APPROVED";
  version: number;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface Condition {
  _id: string;
  projectId: string;
  ruleId: string;
  category: string;
  parameter: string;
  operator: string;
  expectedValue: number | string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  enabled: boolean;
  source: string;
  configurable: boolean;
}

export interface Progress {
  _id: string;
  projectId: string;
  date: string;
  physicalProgress: number;
  reportedWork: string;
  reportedQuantity?: number;
  remarks?: string;
}

export interface Expenditure {
  _id: string;
  projectId: string;
  date: string;
  amount: number;
  category: string;
  invoiceNumber?: string;
  vendor?: string;
  justification?: string;
}

export interface SiteVisit {
  _id: string;
  projectId: string;
  date: string;
  latitude: number;
  longitude: number;
  remarks?: string;
  status: "SCHEDULED" | "COMPLETED" | "MISSED";
}

export interface SimilarityResult {
  comparedEvidenceId: string;
  similarityScore: number;
  comparisonType: "PERCEPTUAL_HASH" | "FILE_HASH";
}

export interface Evidence {
  _id: string;
  projectId: string;
  uploadedBy: string;
  fileName: string;
  filePath: string;
  fileType: string;
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  perceptualHash?: string;
  fileHash: string;
  similarityResults: SimilarityResult[];
  validationStatus: "VALID" | "MISSING" | "INVALID" | "INCONSISTENT" | "SUSPICIOUS" | "PENDING";
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ProjectDocumentType {
  _id: string;
  projectId: string;
  type: string;
  fileName: string;
  filePath: string;
  amount?: number;
  invoiceNumber?: string;
  vendor?: string;
  createdAt: string;
}

export interface Clarification {
  _id: string;
  projectId: string;
  findingIds: string[];
  message: string;
  requiredDocuments: string[];
  deadline?: string;
  response?: string;
  status: "PENDING" | "RESPONDED" | "ACCEPTED" | "NEEDS_MORE_INFO" | "CLOSED";
  createdAt: string;
  respondedAt?: string;
}

export interface ExceptionRequest {
  _id: string;
  projectId: string;
  reason: string;
  ruleId?: string;
  requestedAdjustment: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewComment?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  _id: string;
  userId: string | { _id: string; name: string; role: string };
  role: string;
  action: string;
  entity: string;
  entityId?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface ProjectSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  openInvestigations: number;
}

export interface RowIssue {
  row: number;
  field?: string;
  message: string;
}

export interface ImportSummary<TResult = Record<string, unknown>> {
  totalRows: number;
  validRows: number;
  invalidRows: RowIssue[];
  warnings: RowIssue[];
  results: TResult[];
  importBatchId: string;
  detection?: { riskScore: number; riskLevel: RiskLevel; priority: RiskLevel; findings: Finding[] };
}

export interface Activity {
  _id: string;
  projectId: string;
  activityId: string;
  activityDate: string;
  progressPercent?: number;
  workCompletedDescription?: string;
  quantityCompleted?: number;
  expenditureAmount?: number;
  expenditureCategory?: string;
  invoiceNumber?: string;
  evidenceFileNames: string[];
  remarks?: string;
  importBatchId: string;
  createdAt: string;
}

export type PendingSanction = Omit<Sanction, "projectId"> & {
  projectId: { _id: string; name: string; projectCode: string; district: string; location: string };
};
