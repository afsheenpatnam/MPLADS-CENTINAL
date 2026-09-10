/**
 * Configurable prototype risk weights — NOT official MPLAD weights.
 * See docs/DETECTION_RULES_SOURCE.md and section 15 of the build brief.
 * Sum need not equal 100; the final score is normalized against the sum of
 * these weights (see riskEngine.ts).
 */
export const RISK_CATEGORY_WEIGHTS: Record<string, number> = {
  TIME_PROGRESS: 20,
  FINANCIAL: 25,
  EVIDENCE: 15,
  LOCATION: 15,
  VISIT: 10,
  QUANTITY: 10,
  DOCUMENT: 10,
  CONTRACTOR_PATTERN: 15,
  ML: 10,
};

export const SEVERITY_WEIGHT: Record<string, number> = {
  LOW: 0.25,
  MEDIUM: 0.5,
  HIGH: 0.8,
  CRITICAL: 1.0,
};

export const RISK_LEVEL_THRESHOLDS: { level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; min: number }[] = [
  { level: "CRITICAL", min: 80 },
  { level: "HIGH", min: 60 },
  { level: "MEDIUM", min: 30 },
  { level: "LOW", min: 0 },
];

export function scoreToLevel(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  for (const { level, min } of RISK_LEVEL_THRESHOLDS) {
    if (score >= min) return level;
  }
  return "LOW";
}

/**
 * Maps a finding's (category, type) to one of the 9 risk-weight buckets above.
 * Rule categories that don't have their own weight (PLAN_ACTUAL, QUALITY,
 * SANCTION_COMPLIANCE, CONDITION_COMPLIANCE) are folded into the closest
 * existing bucket rather than adding more categories to the denominator —
 * this keeps the weight table matching the brief's example exactly while
 * still letting every rule category influence the score somewhere sensible.
 */
export function resolveRiskCategory(category: string, type: string): string {
  switch (category) {
    case "WORK_EVIDENCE":
      return type === "LOCATION_MISMATCH" ? "LOCATION" : "EVIDENCE";
    case "QUALITY":
      return "EVIDENCE";
    case "PLAN_ACTUAL":
      return "TIME_PROGRESS";
    case "SANCTION_COMPLIANCE":
      return "FINANCIAL";
    case "CONDITION_COMPLIANCE":
      return "DOCUMENT";
    default:
      return category; // TIME_PROGRESS, FINANCIAL, VISIT, QUANTITY, DOCUMENT, CONTRACTOR_PATTERN
  }
}
