import { Request, Response } from "express";
import { Finding } from "../models/Finding";
import { Project } from "../models/Project";
import { RiskAssessment } from "../models/RiskAssessment";
import { asyncHandler } from "../utils/asyncHandler";
import { runDetectionPipeline } from "../services/detection/detectionPipeline";

export const analyzeProject = asyncHandler(async (req: Request, res: Response) => {
  const project = req.project!;
  const result = await runDetectionPipeline(project._id, req.user);
  res.json(result);
});

export const listFindings = asyncHandler(async (req: Request, res: Response) => {
  const { status, category, severity } = req.query;
  const filter: Record<string, unknown> = { projectId: req.project!._id };
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (severity) filter.severity = severity;

  const findings = await Finding.find(filter).sort({ severity: -1, createdAt: -1 });
  res.json({ findings });
});

export const getProjectRisk = asyncHandler(async (req: Request, res: Response) => {
  const latest = await RiskAssessment.findOne({ projectId: req.project!._id }).sort({ createdAt: -1 });
  const history = await RiskAssessment.find({ projectId: req.project!._id }).sort({ createdAt: -1 }).limit(20);
  res.json({ latest, history });
});

export const getHighPriorityProjects = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const filter: Record<string, unknown> = { priority: { $in: ["HIGH", "CRITICAL"] } };
  if (user.role === "OFFICER") filter.officerId = user.userId;
  if (user.role === "CONTRACTOR") filter.contractorId = user.userId;

  const projects = await Project.find(filter)
    .populate("contractorId", "name email")
    .sort({ riskScore: -1 });

  res.json({ projects });
});
