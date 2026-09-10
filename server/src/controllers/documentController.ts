import fs from "fs";
import { Request, Response } from "express";
import { z } from "zod";
import { ProjectDocument } from "../models/Document";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { computeFileHash } from "../services/cv/evidenceProcessor";
import { recordAudit } from "../services/audit/auditService";
import { emitToUser } from "../realtime/socketServer";
import { runDetectionPipeline } from "../services/detection/detectionPipeline";

const metadataSchema = z.object({
  type: z.string().min(1),
  amount: z.coerce.number().optional(),
  invoiceNumber: z.string().optional(),
  vendor: z.string().optional(),
  date: z.coerce.date().optional(),
});

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (!req.file) throw ApiError.badRequest("No file uploaded");

  const body = metadataSchema.parse(req.body);
  const project = req.project!;
  const buffer = fs.readFileSync(req.file.path);
  const documentHash = computeFileHash(buffer);

  const document = await ProjectDocument.create({
    projectId: project._id,
    uploadedBy: user.userId,
    type: body.type,
    fileName: req.file.originalname,
    filePath: req.file.filename,
    documentHash,
    amount: body.amount,
    invoiceNumber: body.invoiceNumber,
    vendor: body.vendor,
    date: body.date,
  });

  await recordAudit({
    user,
    action: "DOCUMENT_UPLOADED",
    entity: "ProjectDocument",
    entityId: document._id,
    projectId: project._id,
    newValue: { type: body.type, invoiceNumber: body.invoiceNumber },
  });

  emitToUser(project.officerId.toString(), "activity:imported", {
    projectId: project._id.toString(),
    projectCode: project.projectCode,
    source: "MANUAL",
    message: "New document uploaded",
  });

  // Documents feed duplicate-invoice/amount-mismatch detection directly.
  await runDetectionPipeline(project._id, user);

  res.status(201).json({ document });
});

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const documents = await ProjectDocument.find({ projectId: req.project!._id }).sort({ createdAt: -1 });
  res.json({ documents });
});
