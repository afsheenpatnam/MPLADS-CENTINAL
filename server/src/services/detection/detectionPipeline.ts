import { Types } from "mongoose";
import { Project } from "../../models/Project";
import { Sanction } from "../../models/Sanction";
import { Condition } from "../../models/Condition";
import { Milestone } from "../../models/Milestone";
import { Progress } from "../../models/Progress";
import { Expenditure } from "../../models/Expenditure";
import { SiteVisit } from "../../models/SiteVisit";
import { Evidence } from "../../models/Evidence";
import { ProjectDocument } from "../../models/Document";
import { ExceptionRequest } from "../../models/ExceptionRequest";
import { Finding, IFinding } from "../../models/Finding";
import { RiskAssessment } from "../../models/RiskAssessment";
import { runRuleEngine } from "./ruleEngine";
import { DetectionContext, DraftFinding, elapsedPercent } from "./types";
import { analyzeProjectFeatures } from "../ml/mlEngine";
import { computeRisk } from "../risk/riskEngine";
import { computePriority } from "../priority/priorityEngine";
import { emitToUser } from "../../realtime/socketServer";
import { JwtPayload } from "../../utils/jwt";
import { recordAudit } from "../audit/auditService";

const OPEN_STATUSES = ["OPEN", "CLARIFICATION_REQUESTED", "UNDER_REVIEW"] as const;

async function buildContext(projectId: Types.ObjectId): Promise<DetectionContext> {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");

  const [sanction, conditions, milestones, progress, expenditures, siteVisits, evidence, documents, approvedExceptions] =
    await Promise.all([
      Sanction.findOne({ projectId }),
      Condition.find({ projectId }),
      Milestone.find({ projectId }),
      Progress.find({ projectId }),
      Expenditure.find({ projectId }),
      SiteVisit.find({ projectId }),
      Evidence.find({ projectId }),
      ProjectDocument.find({ projectId }),
      ExceptionRequest.find({ projectId, status: "APPROVED" }),
    ]);

  let contractorProjectCount = 0;
  let contractorAnomalyRate = 0;
  if (project.contractorId) {
    const contractorProjects = await Project.find({ contractorId: project.contractorId });
    contractorProjectCount = contractorProjects.length;
    const highRisk = contractorProjects.filter((p) => p.riskLevel === "HIGH" || p.riskLevel === "CRITICAL").length;
    contractorAnomalyRate = contractorProjectCount > 0 ? (highRisk / contractorProjectCount) * 100 : 0;
  }

  return {
    project,
    sanction,
    conditions,
    milestones,
    progress,
    expenditures,
    siteVisits,
    evidence,
    documents,
    approvedExceptions,
    contractorStats: { contractorProjectCount, contractorAnomalyRate },
  };
}

function draftKey(draft: DraftFinding): string {
  const p = draft.parametersUsed as Record<string, unknown>;
  const identity =
    p.evidenceId ?? p.milestoneId ?? p.expenditureId ?? p.documentId ?? p.progressId ?? p.conditionId ?? "singleton";
  return `${draft.ruleId ?? draft.source}:${draft.type}:${identity}`;
}

async function upsertFindings(projectId: Types.ObjectId, drafts: DraftFinding[]): Promise<IFinding[]> {
  const existingOpen = await Finding.find({ projectId, status: { $in: OPEN_STATUSES } });
  const existingByKey = new Map<string, IFinding>();
  for (const f of existingOpen) {
    const key = `${f.ruleId ?? f.source}:${f.type}:${
      (f.parametersUsed as Record<string, unknown>)?.evidenceId ??
      (f.parametersUsed as Record<string, unknown>)?.milestoneId ??
      (f.parametersUsed as Record<string, unknown>)?.expenditureId ??
      (f.parametersUsed as Record<string, unknown>)?.documentId ??
      (f.parametersUsed as Record<string, unknown>)?.progressId ??
      (f.parametersUsed as Record<string, unknown>)?.conditionId ??
      "singleton"
    }`;
    existingByKey.set(key, f);
  }

  for (const draft of drafts) {
    const key = draftKey(draft);
    const existing = existingByKey.get(key);
    if (existing) {
      existing.set({
        severity: draft.severity,
        confidence: draft.confidence,
        title: draft.title,
        description: draft.description,
        expectedValue: draft.expectedValue,
        actualValue: draft.actualValue,
        deviation: draft.deviation,
        evidenceIds: draft.evidenceIds,
        parametersUsed: draft.parametersUsed,
        recommendedAction: draft.recommendedAction,
      });
      await existing.save();
    } else {
      await Finding.create({ ...draft, projectId, status: "OPEN" });
    }
  }

  return Finding.find({ projectId, status: { $in: OPEN_STATUSES } });
}

export interface DetectionRunResult {
  findings: IFinding[];
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  mlSummary: { normalizedScore: number; dominantSignals: unknown[]; modelVersion: string };
}

export async function runDetectionPipeline(
  projectId: string | Types.ObjectId,
  actor?: JwtPayload
): Promise<DetectionRunResult> {
  const id = new Types.ObjectId(projectId);
  const ctx = await buildContext(id);

  // 1. RULE ENGINE
  const ruleDrafts = runRuleEngine(ctx);

  // 2. ML ENGINE — statistical anomaly score over derived project features
  const elapsed = elapsedPercent(ctx.project.startDate, ctx.project.endDate);
  const expenditurePercent = ctx.project.sanctionedAmount > 0 ? (ctx.project.spentAmount / ctx.project.sanctionedAmount) * 100 : 0;
  const requiredVisits = ctx.sanction?.requiredVisits ?? 4;
  const actualVisits = ctx.siteVisits.filter((v) => v.status === "COMPLETED").length;
  const evidenceSimilarity = ctx.evidence.reduce(
    (max, e) => Math.max(max, ...e.similarityResults.map((s) => s.similarityScore), 0),
    0
  );
  const latestQuantity = [...ctx.progress]
    .filter((p) => p.reportedQuantity !== undefined && p.reportedQuantity !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  const quantityDeviation =
    latestQuantity && ctx.project.approvedQuantity
      ? (Math.abs((latestQuantity.reportedQuantity as number) - ctx.project.approvedQuantity) / ctx.project.approvedQuantity) * 100
      : 0;

  const featureRecord = {
    sanctionedAmount: ctx.project.sanctionedAmount,
    spentAmount: ctx.project.spentAmount,
    expenditurePercentage: expenditurePercent,
    elapsedPercentage: elapsed,
    expectedProgress: elapsed,
    actualProgress: ctx.project.actualProgress,
    progressGap: Math.abs(elapsed - ctx.project.actualProgress),
    requiredVisits,
    actualVisits,
    visitCompliance: requiredVisits > 0 ? (actualVisits / requiredVisits) * 100 : 100,
    quantityPlanned: ctx.project.approvedQuantity,
    quantityReported: latestQuantity?.reportedQuantity ?? ctx.project.approvedQuantity,
    quantityDeviation,
    contractorProjectCount: ctx.contractorStats.contractorProjectCount,
    contractorAnomalyRate: ctx.contractorStats.contractorAnomalyRate,
    evidenceSimilarity,
    documentAnomalyCount: 0,
  };
  const mlResult = analyzeProjectFeatures(featureRecord);

  const mlDrafts: DraftFinding[] = [];
  if (mlResult.normalizedScore >= 65) {
    mlDrafts.push({
      category: "ML",
      type: "STATISTICAL_ANOMALY",
      classification: "ANOMALY",
      severity: mlResult.normalizedScore >= 85 ? "HIGH" : "MEDIUM",
      confidence: Math.min(0.95, mlResult.normalizedScore / 100),
      title: "Statistical anomaly detector flagged this project",
      description: `The Isolation Forest anomaly detector scored this project ${mlResult.normalizedScore}/100, driven primarily by: ${mlResult.dominantSignals
        .map((s) => s.feature)
        .join(", ")}. ML detects unusual patterns — it does not determine fraud.`,
      ruleId: undefined,
      source: "ML_ENGINE",
      evidenceIds: [],
      parametersUsed: { normalizedScore: mlResult.normalizedScore, dominantSignals: mlResult.dominantSignals },
      recommendedAction: "Review the dominant signals below alongside rule-based findings.",
    });
  }

  // 3. Persist findings (idempotent upsert against currently-open findings)
  const openFindings = await upsertFindings(id, [...ruleDrafts, ...mlDrafts]);

  // 4. RISK ENGINE
  const risk = computeRisk(openFindings, mlResult);

  await RiskAssessment.create({
    projectId: id,
    score: risk.score,
    level: risk.level,
    priority: risk.level,
    riskFactors: risk.riskFactors,
    ruleScore: risk.ruleScore,
    mlScore: risk.mlScore,
    cvScore: 0,
    financialScore: risk.financialScore,
    progressScore: risk.progressScore,
    evidenceScore: risk.evidenceScore,
    contractorScore: risk.contractorScore,
    modelVersion: mlResult.modelVersion,
    mlFeatures: featureRecord,
    mlNormalizedScore: mlResult.normalizedScore,
    mlDominantSignals: mlResult.dominantSignals,
  });

  // 5. PRIORITY ENGINE
  const priorityResult = computePriority(risk.score, openFindings, ctx.project.sanctionedAmount, ctx.project.spentAmount);

  ctx.project.riskScore = risk.score;
  ctx.project.riskLevel = risk.level;
  ctx.project.priority = priorityResult.priority;
  ctx.project.expectedProgress = Number(elapsed.toFixed(1));
  await ctx.project.save();

  if (actor) {
    await recordAudit({
      user: actor,
      action: "ANOMALY_DETECTED",
      entity: "Project",
      entityId: id,
      projectId: id,
      newValue: { findingCount: openFindings.length, riskScore: risk.score, riskLevel: risk.level },
    });
    await recordAudit({
      user: actor,
      action: "RISK_UPDATED",
      entity: "Project",
      entityId: id,
      projectId: id,
      newValue: { riskScore: risk.score, riskLevel: risk.level, priority: priorityResult.priority },
    });
  }

  // Real-time push to the officer only — this is exactly the officer-only intelligence
  // (risk score, priority, findings) a contractor must never receive.
  const officerId = ctx.project.officerId.toString();
  const eventPayload = {
    projectId: id.toString(),
    projectCode: ctx.project.projectCode,
    riskScore: risk.score,
    riskLevel: risk.level,
    priority: priorityResult.priority,
    findingCount: openFindings.length,
    actualProgress: ctx.project.actualProgress,
    spentAmount: ctx.project.spentAmount,
    updatedAt: new Date().toISOString(),
  };
  emitToUser(officerId, "findings:created", eventPayload);
  emitToUser(officerId, "risk:updated", eventPayload);
  emitToUser(officerId, "priority:updated", eventPayload);
  emitToUser(officerId, "project:updated", eventPayload);
  emitToUser(officerId, "dashboard:updated", eventPayload);

  return {
    findings: openFindings,
    riskScore: risk.score,
    riskLevel: risk.level,
    priority: priorityResult.priority,
    mlSummary: {
      normalizedScore: mlResult.normalizedScore,
      dominantSignals: mlResult.dominantSignals,
      modelVersion: mlResult.modelVersion,
    },
  };
}
