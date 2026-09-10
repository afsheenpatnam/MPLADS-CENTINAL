import { Request, Response } from "express";
import { z } from "zod";
import { Expenditure } from "../models/Expenditure";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/audit/auditService";
import { assertSanctionApproved } from "../services/sanction/sanctionGuard";
import { emitToUser } from "../realtime/socketServer";
import { runDetectionPipeline } from "../services/detection/detectionPipeline";

const expenditureSchema = z.object({
  date: z.coerce.date(),
  amount: z.number().positive(),
  category: z.string().min(1),
  invoiceNumber: z.string().optional(),
  vendor: z.string().optional(),
  justification: z.string().optional(),
  documentIds: z.array(z.string()).optional().default([]),
});

export const submitExpenditure = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== "CONTRACTOR") {
    throw ApiError.forbidden("Only the assigned contractor can submit expenditure");
  }

  const body = expenditureSchema.parse(req.body);
  const project = req.project!;
  await assertSanctionApproved(project._id);

  const expenditure = await Expenditure.create({
    ...body,
    projectId: project._id,
    submittedBy: user.userId,
  });

  project.spentAmount += body.amount;
  await project.save();

  await recordAudit({
    user,
    action: "EXPENDITURE_SUBMITTED",
    entity: "Expenditure",
    entityId: expenditure._id,
    projectId: project._id,
    newValue: { amount: body.amount, category: body.category },
  });

  emitToUser(project.officerId.toString(), "activity:imported", {
    projectId: project._id.toString(),
    projectCode: project.projectCode,
    source: "MANUAL",
    message: "New expenditure submitted",
  });

  // Keep manual submissions and CSV imports equally "real-time" — re-run detection so the
  // officer's risk/findings/priority reflect this submission immediately, not only after a
  // manual "Run Detection" click.
  await runDetectionPipeline(project._id, user);

  res.status(201).json({ expenditure });
});

export const listExpenditure = asyncHandler(async (req: Request, res: Response) => {
  const expenditure = await Expenditure.find({ projectId: req.project!._id }).sort({ date: -1 });
  res.json({ expenditure });
});
