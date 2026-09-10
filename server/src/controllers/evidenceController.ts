import fs from "fs";
import { Request, Response } from "express";
import { z } from "zod";
import { Evidence, ISimilarityResult } from "../models/Evidence";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { analyzeImage, hashSimilarityPercent } from "../services/cv/evidenceProcessor";
import { getRule } from "../services/rules/ruleLoader";
import { recordAudit } from "../services/audit/auditService";
import { assertSanctionApproved } from "../services/sanction/sanctionGuard";
import { emitToUser } from "../realtime/socketServer";
import { runDetectionPipeline } from "../services/detection/detectionPipeline";

const metadataSchema = z.object({
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  timestamp: z.coerce.date().optional(),
});

export const uploadEvidence = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  if (!req.file) throw ApiError.badRequest("No file uploaded");

  const body = metadataSchema.parse(req.body);
  const project = req.project!;
  if (user.role === "CONTRACTOR") await assertSanctionApproved(project._id);

  const buffer = fs.readFileSync(req.file.path);
  const analysis = await analyzeImage(buffer);

  const similarityThreshold = getRule("WORK_004")?.threshold ?? 90;

  // Compare against ALL prior evidence (same project first, then cross-project) —
  // requirement: image reuse detection within a project AND across projects.
  const similarityResults: ISimilarityResult[] = [];
  if (analysis.perceptualHash) {
    const candidates = await Evidence.find({
      perceptualHash: { $ne: null },
    })
      .sort({ createdAt: -1 })
      .limit(500);

    for (const candidate of candidates) {
      if (!candidate.perceptualHash) continue;
      const score = hashSimilarityPercent(analysis.perceptualHash, candidate.perceptualHash);
      if (score >= similarityThreshold) {
        similarityResults.push({
          comparedEvidenceId: candidate._id,
          similarityScore: Number(score.toFixed(2)),
          comparisonType: "PERCEPTUAL_HASH",
        });
      }
    }
  }

  const exactDuplicate = await Evidence.findOne({ fileHash: analysis.fileHash });
  if (exactDuplicate) {
    similarityResults.push({
      comparedEvidenceId: exactDuplicate._id,
      similarityScore: 100,
      comparisonType: "FILE_HASH",
    });
  }

  const validationStatus = similarityResults.length > 0 ? "SUSPICIOUS" : "VALID";

  const evidence = await Evidence.create({
    projectId: project._id,
    uploadedBy: user.userId,
    fileName: req.file.originalname,
    filePath: req.file.filename,
    fileType: req.file.mimetype,
    latitude: body.latitude,
    longitude: body.longitude,
    timestamp: body.timestamp ?? new Date(),
    perceptualHash: analysis.perceptualHash ?? undefined,
    fileHash: analysis.fileHash,
    similarityResults,
    validationStatus,
    metadata: {
      width: analysis.width,
      height: analysis.height,
      format: analysis.format,
      gpsStatus: body.latitude !== undefined && body.longitude !== undefined ? "AVAILABLE" : "GPS_UNAVAILABLE",
    },
  });

  await recordAudit({
    user,
    action: "EVIDENCE_UPLOADED",
    entity: "Evidence",
    entityId: evidence._id,
    projectId: project._id,
    newValue: { fileName: evidence.fileName, validationStatus },
  });

  emitToUser(project.officerId.toString(), "activity:imported", {
    projectId: project._id.toString(),
    projectCode: project.projectCode,
    source: "MANUAL",
    message: "New evidence uploaded",
  });

  // Evidence feeds the location-mismatch/image-reuse rules directly — re-analyze immediately
  // so a reused or off-site photo shows up in the officer's findings without a manual click.
  await runDetectionPipeline(project._id, user);

  res.status(201).json({ evidence: user.role === "CONTRACTOR" ? toContractorSafeEvidence(evidence) : evidence });
});

export const listEvidence = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const evidence = await Evidence.find({ projectId: req.project!._id }).sort({ createdAt: -1 });
  // Similarity/validation results are CV detection output — officer-only intelligence.
  // A contractor sees their own uploads (filename/GPS/timestamp) but not the fraud-risk signal.
  res.json({ evidence: user.role === "CONTRACTOR" ? evidence.map(toContractorSafeEvidence) : evidence });
});

function toContractorSafeEvidence(evidence: InstanceType<typeof Evidence>) {
  const obj = evidence.toObject();
  return { ...obj, similarityResults: [], validationStatus: "UPLOADED" };
}
