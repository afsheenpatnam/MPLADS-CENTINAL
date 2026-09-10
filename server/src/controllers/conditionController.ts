import { Request, Response } from "express";
import { z } from "zod";
import { Condition } from "../models/Condition";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/audit/auditService";

const conditionSchema = z.object({
  ruleId: z.string().min(1),
  category: z.enum(["TIME_PROGRESS", "FINANCIAL", "WORK_EVIDENCE", "QUANTITY", "VISIT", "QUALITY", "OTHER"]),
  parameter: z.string().min(1),
  operator: z.enum([">", "<", ">=", "<=", "==", "!="]),
  expectedValue: z.union([z.number(), z.string()]),
  threshold: z.number().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().default("MEDIUM"),
  source: z.string().optional().default("officer-defined"),
  configurable: z.boolean().optional().default(true),
});

const createConditionsSchema = z.union([conditionSchema, z.array(conditionSchema)]);

export const createConditions = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === "CONTRACTOR") throw ApiError.forbidden("Contractors cannot define conditions");

  const parsed = createConditionsSchema.parse(req.body);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const project = req.project!;

  const conditions = await Condition.insertMany(
    items.map((item) => ({ ...item, projectId: project._id }))
  );

  await recordAudit({
    user,
    action: "CONDITION_CREATED",
    entity: "Condition",
    projectId: project._id,
    newValue: { count: conditions.length },
  });

  res.status(201).json({ conditions });
});

export const listConditions = asyncHandler(async (req: Request, res: Response) => {
  const conditions = await Condition.find({ projectId: req.project!._id }).sort({ createdAt: 1 });
  res.json({ conditions });
});
