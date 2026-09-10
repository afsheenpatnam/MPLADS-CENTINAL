import { Types } from "mongoose";
import { IFinding } from "../../models/Finding";
import { computePriority } from "./priorityEngine";

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

describe("priorityEngine.computePriority", () => {
  it("returns LOW priority for a clean project with no findings", () => {
    const result = computePriority(5, [], 1000000, 100000);
    expect(result.priority).toBe("LOW");
  });

  it("boosts priority score when there are many open findings", () => {
    const zero = computePriority(40, [], 1000000, 100000);
    const many = computePriority(
      40,
      Array.from({ length: 5 }, () => makeFinding({})),
      1000000,
      100000
    );
    expect(many.priorityScore).toBeGreaterThan(zero.priorityScore);
  });

  it("boosts priority score for old unresolved findings", () => {
    const fresh = computePriority(40, [makeFinding({ createdAt: new Date() })], 1000000, 100000);
    const stale = computePriority(
      40,
      [makeFinding({ createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) })],
      1000000,
      100000
    );
    expect(stale.priorityScore).toBeGreaterThan(fresh.priorityScore);
    expect(stale.reasons.some((r) => r.includes("days old"))).toBe(true);
  });

  it("boosts priority score for high financial exposure", () => {
    const lowExposure = computePriority(40, [], 1000000, 100000);
    const highExposure = computePriority(40, [], 1000000, 900000);
    expect(highExposure.priorityScore).toBeGreaterThan(lowExposure.priorityScore);
  });
});
