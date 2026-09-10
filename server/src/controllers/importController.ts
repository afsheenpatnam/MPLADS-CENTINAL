import fs from "fs";
import { Request, Response } from "express";
import { Activity } from "../models/Activity";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { importProjectCsv } from "../services/import/projectImportService";
import { importActivityCsv } from "../services/import/activityImportService";

export const importProjects = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== "OFFICER") throw ApiError.forbidden("Only officers can import project baselines");
  if (!req.file) throw ApiError.badRequest("No CSV file uploaded (expected field 'file')");

  const buffer = fs.readFileSync(req.file.path);
  const summary = await importProjectCsv(buffer, user);

  res.status(summary.invalidRows.length > 0 && summary.validRows === 0 ? 400 : 201).json(summary);
});

export const importActivities = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== "CONTRACTOR") throw ApiError.forbidden("Only the assigned contractor can import daily activity");
  if (!req.file) throw ApiError.badRequest("No CSV file uploaded (expected field 'file')");

  const project = req.project!;
  if (project.contractorId?.toString() !== user.userId) {
    throw ApiError.forbidden("You are not assigned to this project");
  }

  const buffer = fs.readFileSync(req.file.path);
  const summary = await importActivityCsv(buffer, project, user);

  res.status(summary.invalidRows.length > 0 && summary.validRows === 0 ? 400 : 201).json(summary);
});

/** Import history for the "Data Import" tab — visible to both the assigned contractor and officer. */
export const listActivities = asyncHandler(async (req: Request, res: Response) => {
  const activities = await Activity.find({ projectId: req.project!._id }).sort({ createdAt: -1 }).limit(200);
  res.json({ activities });
});
