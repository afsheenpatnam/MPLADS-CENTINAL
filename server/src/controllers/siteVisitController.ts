import { Request, Response } from "express";
import { z } from "zod";
import { SiteVisit } from "../models/SiteVisit";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/audit/auditService";
import { assertSanctionApproved } from "../services/sanction/sanctionGuard";
import { emitToUser } from "../realtime/socketServer";
import { runDetectionPipeline } from "../services/detection/detectionPipeline";

const siteVisitSchema = z.object({
  date: z.coerce.date(),
  latitude: z.number(),
  longitude: z.number(),
  remarks: z.string().optional(),
  evidenceIds: z.array(z.string()).optional().default([]),
  status: z.enum(["SCHEDULED", "COMPLETED", "MISSED"]).optional().default("COMPLETED"),
});

export const submitSiteVisit = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== "CONTRACTOR") {
    throw ApiError.forbidden("Only the assigned contractor can record a site visit");
  }

  const body = siteVisitSchema.parse(req.body);
  const project = req.project!;
  await assertSanctionApproved(project._id);

  const visit = await SiteVisit.create({
    ...body,
    projectId: project._id,
    contractorId: user.userId,
  });

  await recordAudit({
    user,
    action: "SITE_VISIT_SUBMITTED",
    entity: "SiteVisit",
    entityId: visit._id,
    projectId: project._id,
  });

  emitToUser(project.officerId.toString(), "activity:imported", {
    projectId: project._id.toString(),
    projectCode: project.projectCode,
    source: "MANUAL",
    message: "New site visit recorded",
  });

  await runDetectionPipeline(project._id, user);

  res.status(201).json({ visit });
});

export const listSiteVisits = asyncHandler(async (req: Request, res: Response) => {
  const visits = await SiteVisit.find({ projectId: req.project!._id }).sort({ date: -1 });
  res.json({ visits });
});
