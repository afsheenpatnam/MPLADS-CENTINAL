import { Request, Response } from "express";
import { z } from "zod";
import { Finding } from "../models/Finding";
import { Project } from "../models/Project";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/audit/auditService";

const createProjectSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().default(""),
  projectType: z.string().min(2),
  state: z.string().min(2),
  district: z.string().min(2),
  location: z.string().min(2),
  latitude: z.number(),
  longitude: z.number(),
  sanctionedAmount: z.number().positive(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  approvedWork: z.string().optional().default(""),
  approvedQuantity: z.number().optional().default(0),
  approvedMaterials: z.string().optional().default(""),
  contractorId: z.string().optional(),
});

const updateProjectSchema = createProjectSchema.partial().extend({
  releasedAmount: z.number().optional(),
  spentAmount: z.number().optional(),
  status: z.enum(["PLANNED", "ACTIVE", "DELAYED", "COMPLETED", "SUSPENDED"]).optional(),
  actualProgress: z.number().optional(),
});

async function generateProjectCode(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await Project.countDocuments();
  return `MPLAD-${year}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Risk score/level and priority are officer-only intelligence (see requireApprovedSanction's
 * sibling rule in the brief: "contractor must never receive these internals"). Findings/ML/AI
 * routes are already blocked outright for CONTRACTOR, but the Project document itself carries
 * these fields for every viewer, so list/get must redact them here rather than relying on the
 * frontend to simply not render them.
 */
function redactOfficerIntelligence(project: Record<string, unknown>): Record<string, unknown> {
  const { riskScore: _riskScore, riskLevel: _riskLevel, priority: _priority, ...rest } = project;
  return rest;
}

function serializeProject(project: InstanceType<typeof Project>, role: string): Record<string, unknown> {
  const plain = project.toObject({ virtuals: false }) as unknown as Record<string, unknown>;
  return role === "CONTRACTOR" ? redactOfficerIntelligence(plain) : plain;
}

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const body = createProjectSchema.parse(req.body);
  const user = req.user!;
  if (user.role === "CONTRACTOR") throw ApiError.forbidden("Contractors cannot create projects");

  const projectCode = await generateProjectCode();
  const expectedProgress = 0;

  const project = await Project.create({
    ...body,
    projectCode,
    officerId: user.userId,
    expectedProgress,
  });

  await recordAudit({
    user,
    action: "PROJECT_CREATED",
    entity: "Project",
    entityId: project._id,
    projectId: project._id,
    newValue: { name: project.name, sanctionedAmount: project.sanctionedAmount },
  });

  res.status(201).json({ project });
});

export const listProjects = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const filter: Record<string, unknown> = {};

  if (user.role === "OFFICER") filter.officerId = user.userId;
  if (user.role === "CONTRACTOR") filter.contractorId = user.userId;

  const { district, contractorId, projectType, riskLevel, status, from, to } = req.query;
  if (district) filter.district = district;
  if (contractorId) filter.contractorId = contractorId;
  if (projectType) filter.projectType = projectType;
  if (riskLevel) filter.riskLevel = riskLevel;
  if (status) filter.status = status;
  if (from || to) {
    filter.createdAt = {
      ...(from ? { $gte: new Date(String(from)) } : {}),
      ...(to ? { $lte: new Date(String(to)) } : {}),
    };
  }

  const projects = await Project.find(filter)
    .populate("officerId", "name email")
    .populate("contractorId", "name email")
    .sort({ riskScore: -1, updatedAt: -1 });

  res.json({ projects: projects.map((p) => serializeProject(p, user.role)) });
});

export const projectSummary = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const filter: Record<string, unknown> = {};
  if (user.role === "OFFICER") filter.officerId = user.userId;
  if (user.role === "CONTRACTOR") filter.contractorId = user.userId;

  const [total, critical, high, medium, low, openFindings] = await Promise.all([
    Project.countDocuments(filter),
    Project.countDocuments({ ...filter, riskLevel: "CRITICAL" }),
    Project.countDocuments({ ...filter, riskLevel: "HIGH" }),
    Project.countDocuments({ ...filter, riskLevel: "MEDIUM" }),
    Project.countDocuments({ ...filter, riskLevel: "LOW" }),
    Finding.countDocuments({
      status: { $in: ["OPEN", "CLARIFICATION_REQUESTED", "UNDER_REVIEW"] },
      ...(filter.officerId || filter.contractorId
        ? {
            projectId: {
              $in: await Project.find(filter).distinct("_id"),
            },
          }
        : {}),
    }),
  ]);

  res.json({ total, critical, high, medium, low, openInvestigations: openFindings });
});

export const getProject = asyncHandler(async (req: Request, res: Response) => {
  const project = req.project!;
  await project.populate([
    { path: "officerId", select: "name email department" },
    { path: "contractorId", select: "name email phone" },
  ]);
  res.json({ project: serializeProject(project, req.user!.role) });
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const body = updateProjectSchema.parse(req.body);
  const project = req.project!;
  const user = req.user!;
  if (user.role === "CONTRACTOR") throw ApiError.forbidden("Contractors cannot update project baselines");

  const oldValue = project.toObject();
  Object.assign(project, body);
  await project.save();

  await recordAudit({
    user,
    action: "PROJECT_UPDATED",
    entity: "Project",
    entityId: project._id,
    projectId: project._id,
    oldValue,
    newValue: body,
  });

  res.json({ project });
});
