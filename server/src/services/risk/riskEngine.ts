import { IFinding } from "../../models/Finding";
import { MlAnalysisResult } from "../ml/mlEngine";
import { RISK_CATEGORY_WEIGHTS, SEVERITY_WEIGHT, resolveRiskCategory, scoreToLevel } from "./riskWeights";

export interface RiskFactorBreakdown {
  category: string;
  weight: number;
  contribution: number;
  findingCount: number;
}

export interface RiskComputationResult {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskFactors: RiskFactorBreakdown[];
  ruleScore: number;
  mlScore: number;
  financialScore: number;
  progressScore: number;
  evidenceScore: number;
  contractorScore: number;
}

/**
 * Computes a transparent, weighted risk score in [0, 100] from open findings plus
 * the ML anomaly score. For each risk category we take the MAX severity present
 * (not a sum) so that many low-severity findings in one category cannot alone
 * dominate the score the way a single CRITICAL finding does.
 */
export function computeRisk(openFindings: IFinding[], ml: MlAnalysisResult): RiskComputationResult {
  const byCategory = new Map<string, IFinding[]>();
  for (const f of openFindings) {
    const bucket = resolveRiskCategory(f.category, f.type);
    if (!byCategory.has(bucket)) byCategory.set(bucket, []);
    byCategory.get(bucket)!.push(f);
  }

  const riskFactors: RiskFactorBreakdown[] = [];
  let totalContribution = 0;
  let totalWeight = 0;

  for (const [category, weight] of Object.entries(RISK_CATEGORY_WEIGHTS)) {
    if (category === "ML") continue; // handled separately below
    const findings = byCategory.get(category) ?? [];
    totalWeight += weight;
    if (findings.length === 0) {
      riskFactors.push({ category, weight, contribution: 0, findingCount: 0 });
      continue;
    }
    const maxSeverity = findings.reduce(
      (max, f) => Math.max(max, SEVERITY_WEIGHT[f.severity] ?? 0.5),
      0
    );
    const contribution = weight * maxSeverity;
    totalContribution += contribution;
    riskFactors.push({ category, weight, contribution: Number(contribution.toFixed(2)), findingCount: findings.length });
  }

  const mlWeight = RISK_CATEGORY_WEIGHTS.ML;
  totalWeight += mlWeight;
  const mlContribution = mlWeight * (ml.normalizedScore / 100);
  totalContribution += mlContribution;
  riskFactors.push({ category: "ML", weight: mlWeight, contribution: Number(mlContribution.toFixed(2)), findingCount: 0 });

  const score = totalWeight > 0 ? Math.round((totalContribution / totalWeight) * 100) : 0;
  const clampedScore = Math.max(0, Math.min(100, score));

  const sumFor = (categories: string[]) =>
    riskFactors.filter((f) => categories.includes(f.category)).reduce((s, f) => s + f.contribution, 0);

  return {
    score: clampedScore,
    level: scoreToLevel(clampedScore),
    riskFactors,
    ruleScore: Number((totalContribution - mlContribution).toFixed(2)),
    mlScore: Number(mlContribution.toFixed(2)),
    financialScore: sumFor(["FINANCIAL", "DOCUMENT"]),
    progressScore: sumFor(["TIME_PROGRESS"]),
    evidenceScore: sumFor(["EVIDENCE", "LOCATION"]),
    contractorScore: sumFor(["CONTRACTOR_PATTERN", "VISIT"]),
  };
}
