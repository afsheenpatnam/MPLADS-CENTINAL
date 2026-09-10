import { Request, Response } from "express";
import { AIReport } from "../models/AIReport";
import { asyncHandler } from "../utils/asyncHandler";
import { generateAIReport } from "../services/astra/astraReportService";

export const generateSummary = asyncHandler(async (req: Request, res: Response) => {
  const report = await generateAIReport(req.project!._id, req.user);
  res.status(201).json({ report });
});

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const report = await AIReport.findOne({ projectId: req.project!._id }).sort({ generatedAt: -1 });
  res.json({ report });
});
