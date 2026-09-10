import { Request, Response } from "express";
import { z } from "zod";
import { ExceptionRequest } from "../models/ExceptionRequest";
import { Project } from "../models/Project";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/audit/auditService";
import { emitToUser } from "../realtime/socketServer";

const createSchema = z.object({
  conditionId: z.string().optional(),
  ruleId: z.string().optional(),
  reason: z.string().min(1),
  requestedAdjustment: z.number().optional().default(0),
  supportingDocuments: z.array(z.string()).optional().default([]),
});

export const requestException = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== "CONTRACTOR") {
    throw ApiError.forbidden("Only the assigned contractor can request an exception");
  }

  const body = createSchema.parse(req.body);
  const project = req.project!;

  const exceptionRequest = await ExceptionRequest.create({
    ...body,
    projectId: project._id,
    requestedBy: user.userId,
  });

  await recordAudit({
    user,
    action: "EXCEPTION_REQUESTED",
    entity: "ExceptionRequest",
    entityId: exceptionRequest._id,
    projectId: project._id,
    newValue: body,
  });

  emitToUser(project.officerId.toString(), "exception:requested", {
    projectId: project._id.toString(),
    projectCode: project.projectCode,
    message: "Contractor requested an exception",
  });

  res.status(201).json({ exceptionRequest });
});

export const listExceptions = asyncHandler(async (req: Request, res: Response) => {
  const exceptions = await ExceptionRequest.find({ projectId: req.project!._id }).sort({ createdAt: -1 });
  res.json({ exceptions });
});

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewComment: z.string().optional(),
});

export const reviewException = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === "CONTRACTOR") throw ApiError.forbidden("Contractors cannot review exceptions");

  const body = reviewSchema.parse(req.body);
  const exceptionRequest = await ExceptionRequest.findById(req.params.id);
  if (!exceptionRequest) throw ApiError.notFound("Exception request not found");

  const project = await Project.findById(exceptionRequest.projectId);
  if (!project) throw ApiError.notFound("Project not found");
  if (user.role === "OFFICER" && project.officerId.toString() !== user.userId) {
    throw ApiError.forbidden("You do not have access to this exception request");
  }

  exceptionRequest.status = body.decision;
  exceptionRequest.reviewComment = body.reviewComment;
  exceptionRequest.reviewedBy = user.userId as unknown as typeof exceptionRequest.reviewedBy;
  exceptionRequest.reviewedAt = new Date();
  await exceptionRequest.save();

  await recordAudit({
    user,
    action: body.decision === "APPROVED" ? "EXCEPTION_APPROVED" : "EXCEPTION_REJECTED",
    entity: "ExceptionRequest",
    entityId: exceptionRequest._id,
    projectId: exceptionRequest.projectId,
  });

  if (project.contractorId) {
    emitToUser(project.contractorId.toString(), "exception:reviewed", {
      projectId: project._id.toString(),
      projectCode: project.projectCode,
      message: `Your exception request was ${body.decision.toLowerCase()}`,
    });
  }

  res.json({ exceptionRequest });
});
