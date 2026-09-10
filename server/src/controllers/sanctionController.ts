import { Request, Response } from "express";
import { z } from "zod";
import { Sanction } from "../models/Sanction";
import { Project } from "../models/Project";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/audit/auditService";
import { emitToUser } from "../realtime/socketServer";

const sanctionSchema = z.object({
  sanctionedAmount: z.number().positive(),
  duration: z.number().positive(),
  approvedWork: z.string().min(2),
  approvedQuantity: z.number().optional().default(0),
  approvedMaterials: z.string().optional().default(""),
  financialConditions: z.array(z.string()).optional().default([]),
  timelineConditions: z.array(z.string()).optional().default([]),
  workConditions: z.array(z.string()).optional().default([]),
  evidenceConditions: z.array(z.string()).optional().default([]),
  visitConditions: z.array(z.string()).optional().default([]),
  otherConditions: z.array(z.string()).optional().default([]),
  requiredVisits: z.number().optional().default(4),
});

export const createSanction = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === "CONTRACTOR") throw ApiError.forbidden("Contractors cannot create sanctions");

  const body = sanctionSchema.parse(req.body);
  const project = req.project!;

  const existing = await Sanction.findOne({ projectId: project._id });
  if (existing) throw ApiError.conflict("A sanction already exists for this project");

  const sanction = await Sanction.create({
    ...body,
    projectId: project._id,
    createdBy: user.userId,
  });

  project.sanctionedAmount = body.sanctionedAmount;
  project.approvedWork = body.approvedWork;
  project.approvedQuantity = body.approvedQuantity;
  project.approvedMaterials = body.approvedMaterials;
  project.status = "PLANNED";
  await project.save();

  await recordAudit({
    user,
    action: "SANCTION_CREATED",
    entity: "Sanction",
    entityId: sanction._id,
    projectId: project._id,
    newValue: body,
  });

  if (project.contractorId) {
    emitToUser(project.contractorId.toString(), "sanction:pending", {
      projectId: project._id.toString(),
      projectCode: project.projectCode,
      sanctionId: sanction._id.toString(),
    });
  }

  res.status(201).json({ sanction });
});

export const getSanction = asyncHandler(async (req: Request, res: Response) => {
  const sanction = await Sanction.findOne({ projectId: req.project!._id });
  if (!sanction) throw ApiError.notFound("No sanction defined for this project yet");
  res.json({ sanction });
});

/** Sanctions awaiting the logged-in contractor's approval, across all their assigned projects. */
export const listPendingSanctions = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== "CONTRACTOR") throw ApiError.forbidden("Only contractors have sanctions to approve");

  const myProjectIds = await Project.find({ contractorId: user.userId }).distinct("_id");
  const sanctions = await Sanction.find({ projectId: { $in: myProjectIds }, status: "PENDING_APPROVAL" }).populate(
    "projectId",
    "name projectCode district location"
  );
  res.json({ sanctions });
});

export const approveSanction = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== "CONTRACTOR") throw ApiError.forbidden("Only the assigned contractor can approve a sanction");

  const sanction = await Sanction.findById(req.params.id);
  if (!sanction) throw ApiError.notFound("Sanction not found");

  const project = await Project.findById(sanction.projectId);
  if (!project || project.contractorId?.toString() !== user.userId) {
    throw ApiError.forbidden("You are not assigned to this project");
  }
  if (sanction.status === "APPROVED") throw ApiError.conflict("This sanction is already approved");

  sanction.status = "APPROVED";
  sanction.approvedBy = user.userId as unknown as typeof sanction.approvedBy;
  sanction.approvedAt = new Date();
  await sanction.save();

  project.status = "ACTIVE";
  await project.save();

  await recordAudit({
    user,
    action: "SANCTION_CREATED",
    entity: "Sanction",
    entityId: sanction._id,
    projectId: project._id,
    newValue: { status: "APPROVED" },
    metadata: { note: "Sanction approved by contractor" },
  });

  emitToUser(project.officerId.toString(), "activity:imported", {
    projectId: project._id.toString(),
    projectCode: project.projectCode,
    message: "Contractor approved the sanction — project is now active",
  });

  res.json({ sanction });
});
