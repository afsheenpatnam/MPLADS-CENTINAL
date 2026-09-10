import { Types } from "mongoose";
import { IFinding } from "../../models/Finding";
import { MlAnalysisResult } from "../ml/mlEngine";
import { computeRisk } from "./riskEngine";

function makeFinding(overrides: Partial<IFinding>): IFinding {
  return {
    _id: new Types.ObjectId(),
    category: "FINANCIAL",
    type: "COST_PROGRESS_MISMATCH",
    classification: "FRAUD_RISK_INDICATOR",
    severity: "HIGH",
    confidence: 0.9,
    status: "OPEN",
    createdAt: new Date(),
    evidenceIds: [],
    parametersUsed: {},
    ...overrides,
  } as unknown as IFinding;
}

const noAnomalyMl: MlAnalysisResult = {
  anomalyScore: 0.4,
  normalizedScore: 0,
  modelVersion: "test",
  featuresUsed: [],
  dominantSignals: [],
};

describe("riskEngine.computeRisk", () => {
  it("returns a low score with no findings and no ML signal", () => {
    const result = computeRisk([], noAnomalyMl);
    expect(result.score).toBeLessThan(10);
    expect(result.level).toBe("LOW");
  });

  it("increases score with more severe findings across more categories", () => {
    const single = computeRisk([makeFinding({ category: "FINANCIAL", severity: "MEDIUM" })], noAnomalyMl);
    const many = computeRisk(
      [
        makeFinding({ category: "FINANCIAL", type: "COST_PROGRESS_MISMATCH", severity: "CRITICAL" }),
        makeFinding({ category: "TIME_PROGRESS", type: "PROGRESS_ANOMALY", severity: "HIGH" }),
        makeFinding({ category: "VISIT", type: "VISIT_COMPLIANCE_VIOLATION", severity: "HIGH" }),
        makeFinding({ category: "WORK_EVIDENCE", type: "LOCATION_MISMATCH", severity: "HIGH" }),
      ],
      noAnomalyMl
    );
    expect(many.score).toBeGreaterThan(single.score);
  });

  it("does not let many low-severity findings in one category alone reach CRITICAL", () => {
    const findings = Array.from({ length: 20 }, () =>
      makeFinding({ category: "QUANTITY", type: "QUANTITY_DEVIATION", severity: "LOW" })
    );
    const result = computeRisk(findings, noAnomalyMl);
    expect(result.level).not.toBe("CRITICAL");
  });

  it("reaches CRITICAL when every risk category has a CRITICAL finding and ML agrees", () => {
    const critical = computeRisk(
      [
        makeFinding({ category: "FINANCIAL", type: "COST_PROGRESS_MISMATCH", severity: "CRITICAL" }),
        makeFinding({ category: "TIME_PROGRESS", type: "PROGRESS_ANOMALY", severity: "CRITICAL" }),
        makeFinding({ category: "WORK_EVIDENCE", type: "LOCATION_MISMATCH", severity: "CRITICAL" }),
        makeFinding({ category: "WORK_EVIDENCE", type: "IMAGE_REUSE_OR_HIGH_SIMILARITY", severity: "CRITICAL" }),
        makeFinding({ category: "VISIT", type: "VISIT_COMPLIANCE_VIOLATION", severity: "CRITICAL" }),
        makeFinding({ category: "QUANTITY", type: "QUANTITY_DEVIATION", severity: "CRITICAL" }),
        makeFinding({ category: "DOCUMENT", type: "DOCUMENT_AMOUNT_MISMATCH", severity: "CRITICAL" }),
        makeFinding({ category: "CONTRACTOR_PATTERN", type: "CONTRACTOR_PATTERN", severity: "CRITICAL" }),
      ],
      { ...noAnomalyMl, normalizedScore: 100 }
    );
    expect(critical.score).toBeGreaterThanOrEqual(80);
    expect(critical.level).toBe("CRITICAL");
  });

  it("reaches HIGH (but not necessarily CRITICAL) for a multi-signal scenario resembling the main demo", () => {
    // Cost-progress mismatch + progress lag + location mismatch + image reuse + visit violation,
    // all at the rules.json-configured HIGH severity, mirrors the flagship demo scenario.
    const result = computeRisk(
      [
        makeFinding({ category: "FINANCIAL", type: "COST_PROGRESS_MISMATCH", severity: "HIGH" }),
        makeFinding({ category: "TIME_PROGRESS", type: "PROGRESS_ANOMALY", severity: "HIGH" }),
        makeFinding({ category: "WORK_EVIDENCE", type: "LOCATION_MISMATCH", severity: "HIGH" }),
        makeFinding({ category: "WORK_EVIDENCE", type: "IMAGE_REUSE_OR_HIGH_SIMILARITY", severity: "HIGH" }),
        makeFinding({ category: "VISIT", type: "VISIT_COMPLIANCE_VIOLATION", severity: "HIGH" }),
        makeFinding({ category: "QUANTITY", type: "QUANTITY_DEVIATION", severity: "HIGH" }),
      ],
      { ...noAnomalyMl, normalizedScore: 80 }
    );
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(["HIGH", "CRITICAL"]).toContain(result.level);
  });
});
