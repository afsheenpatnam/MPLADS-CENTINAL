import { Request, Response } from "express";
import { z } from "zod";
import { Finding } from "../models/Finding";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/audit/auditService";
import { emitToUser } from "../realtime/socketServer";

const resolveSchema = z.object({
  findingId: z.string().min(1),
  status: z.enum(["RESOLVED", "DISMISSED"]),
  resolutionNote: z.string().min(1),
});

export const resolveInvestigation = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === "CONTRACTOR") throw ApiError.forbidden("Contractors cannot resolve investigations");

  const body = resolveSchema.parse(req.body);
  const finding = await Finding.findOne({ _id: body.findingId, projectId: req.project!._id });
  if (!finding) throw ApiError.notFound("Finding not found for this project");

  finding.status = body.status;
  finding.resolvedAt = new Date();
  finding.resolvedBy = user.userId as unknown as typeof finding.resolvedBy;
  finding.resolutionNote = body.resolutionNote;
  await finding.save();

  await recordAudit({
    user,
    action: "INVESTIGATION_RESOLVED",
    entity: "Finding",
    entityId: finding._id,
    projectId: req.project!._id,
    newValue: { status: body.status, resolutionNote: body.resolutionNote },
  });

  if (req.project!.contractorId) {
    emitToUser(req.project!.contractorId.toString(), "investigation:resolved", {
      projectId: req.project!._id.toString(),
      projectCode: req.project!.projectCode,
      message: `A finding on your project was ${body.status.toLowerCase()}`,
    });
  }

  res.json({ finding });
});
