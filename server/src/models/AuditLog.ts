import { Schema, model, Document, Types } from "mongoose";

export type AuditAction =
  | "LOGIN"
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "SANCTION_CREATED"
  | "CONDITION_CREATED"
  | "PROGRESS_SUBMITTED"
  | "EXPENDITURE_SUBMITTED"
  | "EVIDENCE_UPLOADED"
  | "DOCUMENT_UPLOADED"
  | "SITE_VISIT_SUBMITTED"
  | "ANOMALY_DETECTED"
  | "RISK_UPDATED"
  | "AI_REPORT_GENERATED"
  | "CLARIFICATION_REQUESTED"
  | "CLARIFICATION_RESPONDED"
  | "EXCEPTION_REQUESTED"
  | "EXCEPTION_APPROVED"
  | "EXCEPTION_REJECTED"
  | "INVESTIGATION_RESOLVED";

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  role: string;
  projectId?: Types.ObjectId;
  action: AuditAction;
  entity: string;
  entityId?: Types.ObjectId;
  oldValue?: unknown;
  newValue?: unknown;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, required: true },
  projectId: { type: Schema.Types.ObjectId, ref: "Project" },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
  metadata: { type: Schema.Types.Mixed, default: {} },
});

AuditLogSchema.index({ projectId: 1, timestamp: -1 });

export const AuditLog = model<IAuditLog>("AuditLog", AuditLogSchema);
