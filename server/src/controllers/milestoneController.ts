import { Request, Response } from "express";
import { z } from "zod";
import { Milestone } from "../models/Milestone";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";

const milestoneSchema = z.object({
  name: z.string().min(1),
  expectedDate: z.coerce.date(),
  expectedProgress: z.number().min(0).max(100),
});

const createMilestonesSchema = z.union([milestoneSchema, z.array(milestoneSchema)]);

export const createMilestones = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === "CONTRACTOR") throw ApiError.forbidden("Contractors cannot define milestones");

  const parsed = createMilestonesSchema.parse(req.body);
  const items = Array.isArray(parsed) ? parsed : [parsed];

  const milestones = await Milestone.insertMany(
    items.map((item) => ({ ...item, projectId: req.project!._id }))
  );
  res.status(201).json({ milestones });
});

export const listMilestones = asyncHandler(async (req: Request, res: Response) => {
  const milestones = await Milestone.find({ projectId: req.project!._id }).sort({ expectedDate: 1 });
  res.json({ milestones });
});
