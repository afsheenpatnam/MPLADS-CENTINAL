import { IFinding } from "../../models/Finding";
import { scoreToLevel } from "../risk/riskWeights";

export interface PriorityResult {
  priorityScore: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasons: string[];
}

/**
 * Priority answers "which projects need officer attention right now?" — it starts
 * from the risk score but also weighs how many findings are open, how severe they
 * are, and how long they've sat unresolved (investigation age), plus financial
 * exposure. All bonus weights below are configurable prototype values.
 */
export function computePriority(
  riskScore: number,
  openFindings: IFinding[],
  sanctionedAmount: number,
  spentAmount: number
): PriorityResult {
  const reasons: string[] = [];

  const unresolvedBonus = Math.min(15, openFindings.length * 3);
  if (openFindings.length > 0) reasons.push(`${openFindings.length} unresolved finding(s)`);

  const criticalOrHigh = openFindings.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH").length;
  const severityBonus = Math.min(10, criticalOrHigh * 4);
  if (criticalOrHigh > 0) reasons.push(`${criticalOrHigh} HIGH/CRITICAL severity finding(s)`);

  const oldestOpen = openFindings.reduce<Date | null>((oldest, f) => {
    if (!oldest || f.createdAt < oldest) return f.createdAt;
    return oldest;
  }, null);
  const ageDays = oldestOpen ? (Date.now() - oldestOpen.getTime()) / (1000 * 60 * 60 * 24) : 0;
  const ageBonus = Math.min(10, ageDays / 3);
  if (ageDays > 14) reasons.push(`oldest open finding is ${Math.round(ageDays)} days old`);

  const exposureRatio = sanctionedAmount > 0 ? spentAmount / sanctionedAmount : 0;
  const exposureBonus = exposureRatio > 0.5 ? Math.min(10, exposureRatio * 10) : 0;
  if (exposureRatio > 0.5) reasons.push(`₹${spentAmount.toLocaleString("en-IN")} already disbursed`);

  const priorityScore = Math.max(0, Math.min(100, Math.round(riskScore + unresolvedBonus + severityBonus + ageBonus + exposureBonus)));

  return { priorityScore, priority: scoreToLevel(priorityScore), reasons };
}
