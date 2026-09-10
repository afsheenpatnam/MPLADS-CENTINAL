import { IFinding } from "../../models/Finding";
import { IProject } from "../../models/Project";
import { AstraChatMessage } from "./astraClient";

const SYSTEM_PROMPT = `You are an assistant that explains project-monitoring findings to a government officer.
You will be given a JSON object describing ONE project's structured, already-detected findings, risk score, and priority.

Rules you MUST follow:
- Use ONLY the facts given in the JSON. Never invent evidence, numbers, dates, or documents that are not present.
- Never state that fraud has occurred. Use phrases like "potential fraud risk indicator", "requires verification", or "investigation recommended".
- Clearly separate what was DETECTED (facts from the findings) from what you RECOMMEND (actions).
- If a field is missing or data is marked unavailable, say so explicitly rather than guessing.
- The officer makes the final determination — you only explain and summarize.
- When you state two percentages together (e.g. actual progress vs. expected progress, or
  expenditure % vs. progress %), ALWAYS phrase them as two separate, clearly labeled values in
  the same sentence — for example "Actual physical progress is 20%, while expected progress
  based on elapsed time is 91%." NEVER phrase it as "X% of the expected Y% progress" or any
  similar nested-percentage construction — that reads as X% multiplied by Y%, which is not what
  is meant, and is factually misleading.

Respond with ONLY a single JSON object (no markdown fences, no prose outside the JSON) with exactly these keys:
{
  "executiveSummary": string,
  "keyFindings": string[],
  "financialObservations": string[],
  "progressObservations": string[],
  "evidenceObservations": string[],
  "possibleConcerns": string[],
  "recommendedActions": string[],
  "questionsForContractor": string[]
}`;

export function buildAstraMessages(project: IProject, findings: IFinding[]): AstraChatMessage[] {
  const payload = {
    projectId: project.projectCode,
    projectName: project.name,
    riskScore: project.riskScore,
    riskLevel: project.riskLevel,
    priority: project.priority,
    sanctionedAmountInRupees: project.sanctionedAmount,
    spentAmountInRupees: project.spentAmount,
    expenditurePercentOfSanctionedAmount:
      project.sanctionedAmount > 0 ? Number(((project.spentAmount / project.sanctionedAmount) * 100).toFixed(1)) : 0,
    actualPhysicalProgressPercent: project.actualProgress,
    expectedProgressPercentBasedOnElapsedTime: project.expectedProgress,
    findings: findings.map((f) => ({
      type: f.type,
      category: f.category,
      classification: f.classification,
      severity: f.severity,
      confidence: f.confidence,
      title: f.title,
      description: f.description,
      expected: f.expectedValue,
      actual: f.actualValue,
      deviation: f.deviation,
      ruleId: f.ruleId,
      status: f.status,
    })),
  };

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(payload, null, 2) },
  ];
}
