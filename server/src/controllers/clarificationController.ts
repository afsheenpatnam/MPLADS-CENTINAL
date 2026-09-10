import { Request, Response } from "express";
import { z } from "zod";
import { Clarification } from "../models/Clarification";
import { Finding } from "../models/Finding";
import { Project } from "../models/Project";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/audit/auditService";
import { emitToUser } from "../realtime/socketServer";

const createSchema = z.object({
  findingIds: z.array(z.string()).min(1),
  message: z.string().min(1),
  requiredDocuments: z.array(z.string()).optional().default([]),
  deadline: z.coerce.date().optional(),
});

export const requestClarification = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === "CONTRACTOR") throw ApiError.forbidden("Contractors cannot request clarifications");

  const body = createSchema.parse(req.body);
  const project = req.project!;

  const clarification = await Clarification.create({
    ...body,
    projectId: project._id,
    requestedBy: user.userId,
  });

  await Finding.updateMany(
    { _id: { $in: body.findingIds } },
    { $set: { status: "CLARIFICATION_REQUESTED" } }
  );

  await recordAudit({
    user,
    action: "CLARIFICATION_REQUESTED",
    entity: "Clarification",
    entityId: clarification._id,
    projectId: project._id,
    newValue: { findingIds: body.findingIds },
  });

  if (project.contractorId) {
    emitToUser(project.contractorId.toString(), "clarification:requested", {
      projectId: project._id.toString(),
      projectCode: project.projectCode,
      message: "An officer requested clarification on a finding",
    });
  }

  res.status(201).json({ clarification });
});

export const listClarifications = asyncHandler(async (req: Request, res: Response) => {
  const clarifications = await Clarification.find({ projectId: req.project!._id }).sort({ createdAt: -1 });
  res.json({ clarifications });
});

const respondSchema = z.object({
  response: z.string().min(1),
  responseDocumentIds: z.array(z.string()).optional().default([]),
});

export const respondToClarification = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== "CONTRACTOR") {
    throw ApiError.forbidden("Only the contractor can respond to a clarification");
  }

  const body = respondSchema.parse(req.body);
  const clarification = await Clarification.findById(req.params.id);
  if (!clarification) throw ApiError.notFound("Clarification not found");

  const project = await Project.findById(clarification.projectId);
  if (!project || project.contractorId?.toString() !== user.userId) {
    throw ApiError.forbidden("You do not have access to this clarification");
  }

  clarification.response = body.response;
  clarification.responseDocumentIds = body.responseDocumentIds as unknown as typeof clarification.responseDocumentIds;
  clarification.respondedBy = user.userId as unknown as typeof clarification.respondedBy;
  clarification.status = "RESPONDED";
  clarification.respondedAt = new Date();
  await clarification.save();

  await recordAudit({
    user,
    action: "CLARIFICATION_RESPONDED",
    entity: "Clarification",
    entityId: clarification._id,
    projectId: clarification.projectId,
  });

  emitToUser(project.officerId.toString(), "clarification:responded", {
    projectId: project._id.toString(),
    projectCode: project.projectCode,
    message: "Contractor responded to a clarification request",
  });

  res.json({ clarification });
});

const reviewSchema = z.object({
  decision: z.enum(["ACCEPT", "NEEDS_MORE_INFO", "KEEP_OPEN", "RESOLVE"]),
  resolutionNote: z.string().optional(),
});

export const reviewClarification = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === "CONTRACTOR") throw ApiError.forbidden("Contractors cannot review clarifications");

  const body = reviewSchema.parse(req.body);
  const clarification = await Clarification.findById(req.params.id);
  if (!clarification) throw ApiError.notFound("Clarification not found");

  if (body.decision === "ACCEPT") clarification.status = "ACCEPTED";
  if (body.decision === "NEEDS_MORE_INFO") clarification.status = "NEEDS_MORE_INFO";
  if (body.decision === "RESOLVE") clarification.status = "CLOSED";
  await clarification.save();

  if (body.decision === "RESOLVE") {
    await Finding.updateMany(
      { _id: { $in: clarification.findingIds } },
      {
        $set: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedBy: user.userId,
          resolutionNote: body.resolutionNote ?? "Resolved via clarification review",
        },
      }
    );
  } else if (body.decision === "ACCEPT") {
    await Finding.updateMany({ _id: { $in: clarification.findingIds } }, { $set: { status: "UNDER_REVIEW" } });
  } else if (body.decision === "NEEDS_MORE_INFO") {
    await Finding.updateMany({ _id: { $in: clarification.findingIds } }, { $set: { status: "CLARIFICATION_REQUESTED" } });
  }

  const project = await Project.findById(clarification.projectId);
  if (project?.contractorId) {
    emitToUser(project.contractorId.toString(), "clarification:reviewed", {
      projectId: project._id.toString(),
      projectCode: project.projectCode,
      message: `Officer ${body.decision === "RESOLVE" ? "resolved" : body.decision === "ACCEPT" ? "accepted your explanation for" : "requested more information on"} a clarification`,
    });
  }

  res.json({ clarification });
});
