import { Types } from "mongoose";
import { AIReport, IAIReport } from "../../models/AIReport";
import { Finding } from "../../models/Finding";
import { Project } from "../../models/Project";
import { env } from "../../config/env";
import { callAstra } from "./astraClient";
import { buildAstraMessages } from "./astraPromptBuilder";
import { recordAudit } from "../audit/auditService";
import { JwtPayload } from "../../utils/jwt";

interface ParsedAstraReport {
  executiveSummary: string;
  keyFindings: string[];
  financialObservations: string[];
  progressObservations: string[];
  evidenceObservations: string[];
  possibleConcerns: string[];
  recommendedActions: string[];
  questionsForContractor: string[];
}

function safeParse(content: string): ParsedAstraReport | null {
  try {
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");
    const jsonSlice = jsonStart >= 0 && jsonEnd >= 0 ? content.slice(jsonStart, jsonEnd + 1) : content;
    const parsed = JSON.parse(jsonSlice);
    return {
      executiveSummary: String(parsed.executiveSummary ?? ""),
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings.map(String) : [],
      financialObservations: Array.isArray(parsed.financialObservations) ? parsed.financialObservations.map(String) : [],
      progressObservations: Array.isArray(parsed.progressObservations) ? parsed.progressObservations.map(String) : [],
      evidenceObservations: Array.isArray(parsed.evidenceObservations) ? parsed.evidenceObservations.map(String) : [],
      possibleConcerns: Array.isArray(parsed.possibleConcerns) ? parsed.possibleConcerns.map(String) : [],
      recommendedActions: Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions.map(String) : [],
      questionsForContractor: Array.isArray(parsed.questionsForContractor) ? parsed.questionsForContractor.map(String) : [],
    };
  } catch {
    return null;
  }
}

export async function generateAIReport(projectId: string | Types.ObjectId, actor?: JwtPayload): Promise<IAIReport> {
  const id = new Types.ObjectId(projectId);
  const project = await Project.findById(id);
  if (!project) throw new Error("Project not found");

  const findings = await Finding.find({ projectId: id, status: { $ne: "DISMISSED" } }).sort({ severity: -1 });

  const messages = buildAstraMessages(project, findings);
  const result = await callAstra(messages);

  let report: IAIReport;

  if (!result.ok || !result.content) {
    console.error(`[astra] Call failed for project ${project.projectCode}: ${result.error ?? "no content returned"}`);
    report = await AIReport.create({
      projectId: id,
      riskScore: project.riskScore,
      riskLevel: project.riskLevel,
      executiveSummary: "AI summary temporarily unavailable.",
      modelName: env.astraModel || "unconfigured",
      status: "UNAVAILABLE",
    });
  } else {
    const parsed = safeParse(result.content);
    if (!parsed) {
      console.error(
        `[astra] Response for project ${project.projectCode} was not valid JSON (length ${result.content.length}). ` +
          `Raw content (first 500 chars): ${result.content.slice(0, 500)}`
      );
      report = await AIReport.create({
        projectId: id,
        riskScore: project.riskScore,
        riskLevel: project.riskLevel,
        executiveSummary: "AI summary temporarily unavailable.",
        modelName: env.astraModel,
        status: "UNAVAILABLE",
      });
    } else {
      report = await AIReport.create({
        projectId: id,
        riskScore: project.riskScore,
        riskLevel: project.riskLevel,
        ...parsed,
        modelName: env.astraModel,
        status: "GENERATED",
      });
    }
  }

  if (actor) {
    await recordAudit({
      user: actor,
      action: "AI_REPORT_GENERATED",
      entity: "AIReport",
      entityId: report._id,
      projectId: id,
      newValue: { status: report.status },
    });
  }

  return report;
}
