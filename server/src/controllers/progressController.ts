import { Request, Response } from "express";
import { z } from "zod";
import { Progress } from "../models/Progress";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/audit/auditService";
import { assertSanctionApproved } from "../services/sanction/sanctionGuard";
import { emitToUser } from "../realtime/socketServer";
import { runDetectionPipeline } from "../services/detection/detectionPipeline";

const progressSchema = z.object({
  date: z.coerce.date(),
  physicalProgress: z.number().min(0).max(100),
  reportedWork: z.string().min(1),
  reportedQuantity: z.number().optional(),
  milestoneId: z.string().optional(),
  remarks: z.string().optional(),
  supportingEvidence: z.array(z.string()).optional().default([]),
});

export const submitProgress = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== "CONTRACTOR") {
    throw ApiError.forbidden("Only the assigned contractor can submit progress");
  }

  const body = progressSchema.parse(req.body);
  const project = req.project!;
  await assertSanctionApproved(project._id);

  const progress = await Progress.create({
    ...body,
    projectId: project._id,
    submittedBy: user.userId,
  });

  if (body.physicalProgress > project.actualProgress) {
    project.actualProgress = body.physicalProgress;
    await project.save();
  }

  await recordAudit({
    user,
    action: "PROGRESS_SUBMITTED",
    entity: "Progress",
    entityId: progress._id,
    projectId: project._id,
    newValue: { physicalProgress: body.physicalProgress },
  });

  emitToUser(project.officerId.toString(), "activity:imported", {
    projectId: project._id.toString(),
    projectCode: project.projectCode,
    source: "MANUAL",
    message: "New progress submitted",
  });

  await runDetectionPipeline(project._id, user);

  res.status(201).json({ progress });
});

export const listProgress = asyncHandler(async (req: Request, res: Response) => {
  const progress = await Progress.find({ projectId: req.project!._id }).sort({ date: -1 });
  res.json({ progress });
});
