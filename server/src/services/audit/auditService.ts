import { Types } from "mongoose";
import { AuditAction, AuditLog } from "../../models/AuditLog";
import { JwtPayload } from "../../utils/jwt";

interface RecordAuditInput {
  user: JwtPayload;
  action: AuditAction;
  entity: string;
  entityId?: Types.ObjectId | string;
  projectId?: Types.ObjectId | string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  await AuditLog.create({
    userId: input.user.userId,
    role: input.user.role,
    projectId: input.projectId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    oldValue: input.oldValue,
    newValue: input.newValue,
    metadata: input.metadata ?? {},
    timestamp: new Date(),
  });
}
