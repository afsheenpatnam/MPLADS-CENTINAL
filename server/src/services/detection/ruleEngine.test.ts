import { Types } from "mongoose";
import { IProject } from "../../models/Project";
import { ISanction } from "../../models/Sanction";
import { ICondition } from "../../models/Condition";
import { IEvidence } from "../../models/Evidence";
import { runRuleEngine } from "./ruleEngine";
import { DetectionContext } from "./types";

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

function baseProject(overrides: Partial<IProject> = {}): IProject {
  return {
    _id: new Types.ObjectId(),
    projectCode: "MPLAD-TEST-0001",
    name: "Test Project",
    latitude: 20,
    longitude: 78,
    sanctionedAmount: 1000000,
    releasedAmount: 900000,
    spentAmount: 200000,
    startDate: daysAgo(330), // ~11 months into a 12-month project
    endDate: daysFromNow(30),
    approvedWork: "Construct road with drainage",
    approvedQuantity: 1000,
    actualProgress: 20,
    status: "ACTIVE",
    ...overrides,
  } as unknown as IProject;
}

function baseContext(overrides: Partial<DetectionContext> = {}): DetectionContext {
  return {
    project: baseProject(),
    sanction: { requiredVisits: 8 } as unknown as ISanction,
    conditions: [],
    milestones: [],
    progress: [],
    expenditures: [],
    siteVisits: [],
    evidence: [],
    documents: [],
    approvedExceptions: [],
    contractorStats: { contractorProjectCount: 1, contractorAnomalyRate: 0 },
    ...overrides,
  };
}

describe("ruleEngine PROGRESS_001 (progress vs time elapsed)", () => {
  it("flags a project 92% through its timeline with only 20% progress", () => {
    const ctx = baseContext({ project: baseProject({ actualProgress: 20 }) });
    const findings = runRuleEngine(ctx);
    const finding = findings.find((f) => f.ruleId === "PROGRESS_001");
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("HIGH");
  });

  it("does not flag a project on track", () => {
    const ctx = baseContext({
      project: baseProject({ startDate: daysAgo(60), endDate: daysFromNow(60), actualProgress: 48 }),
    });
    const findings = runRuleEngine(ctx);
    expect(findings.find((f) => f.ruleId === "PROGRESS_001")).toBeUndefined();
  });
});

describe("ruleEngine FINANCIAL_001 (cost-progress mismatch)", () => {
  it("flags 90% expenditure against 20% physical progress", () => {
    const ctx = baseContext({
      project: baseProject({ sanctionedAmount: 5000000, spentAmount: 4500000, actualProgress: 20 }),
    });
    const findings = runRuleEngine(ctx);
    const finding = findings.find((f) => f.ruleId === "FINANCIAL_001");
    expect(finding).toBeDefined();
    expect(finding?.actualValue).toBeCloseTo(90, 0);
  });
});

describe("ruleEngine VISIT_001 (site visit compliance)", () => {
  it("flags a shortfall of required vs actual visits", () => {
    const ctx = baseContext({
      sanction: { requiredVisits: 8 } as unknown as ISanction,
      siteVisits: [
        { status: "COMPLETED" },
        { status: "COMPLETED" },
        { status: "COMPLETED" },
      ] as any,
    });
    const findings = runRuleEngine(ctx);
    const finding = findings.find((f) => f.ruleId === "VISIT_001");
    expect(finding).toBeDefined();
    expect(finding?.actualValue).toBe(3);
    expect(finding?.expectedValue).toBe(8);
  });

  it("accounts for an approved exception reducing the effective requirement", () => {
    const ctx = baseContext({
      sanction: { requiredVisits: 8 } as unknown as ISanction,
      siteVisits: [{ status: "COMPLETED" }, { status: "COMPLETED" }, { status: "COMPLETED" }] as any,
      approvedExceptions: [{ ruleId: "VISIT_001", requestedAdjustment: 5 }] as any,
    });
    const findings = runRuleEngine(ctx);
    expect(findings.find((f) => f.ruleId === "VISIT_001")).toBeUndefined();
  });
});

describe("ruleEngine WORK_002 (location mismatch)", () => {
  it("flags evidence far from the registered project location", () => {
    const evidence = {
      _id: new Types.ObjectId(),
      fileName: "photo.jpg",
      latitude: 21, // ~111km away from lat 20
      longitude: 78,
      similarityResults: [],
    } as unknown as IEvidence;

    const ctx = baseContext({ evidence: [evidence] });
    const findings = runRuleEngine(ctx);
    expect(findings.find((f) => f.ruleId === "WORK_002")).toBeDefined();
  });

  it("does not flag evidence close to the project location", () => {
    const evidence = {
      _id: new Types.ObjectId(),
      fileName: "photo.jpg",
      latitude: 20.0005,
      longitude: 78.0005,
      similarityResults: [],
    } as unknown as IEvidence;

    const ctx = baseContext({ evidence: [evidence] });
    const findings = runRuleEngine(ctx);
    expect(findings.find((f) => f.ruleId === "WORK_002")).toBeUndefined();
  });
});

describe("ruleEngine CONDITION_001 (officer-defined condition compliance)", () => {
  it("flags a condition that evaluates to false", () => {
    const condition = {
      _id: new Types.ObjectId(),
      enabled: true,
      parameter: "actualProgress",
      operator: ">=",
      expectedValue: 50,
      severity: "HIGH",
    } as unknown as ICondition;

    const ctx = baseContext({ conditions: [condition], project: baseProject({ actualProgress: 20 }) });
    const findings = runRuleEngine(ctx);
    expect(findings.find((f) => f.ruleId === "CONDITION_001")).toBeDefined();
  });

  it("does not flag a condition that is satisfied", () => {
    const condition = {
      _id: new Types.ObjectId(),
      enabled: true,
      parameter: "actualProgress",
      operator: ">=",
      expectedValue: 10,
      severity: "HIGH",
    } as unknown as ICondition;

    const ctx = baseContext({ conditions: [condition], project: baseProject({ actualProgress: 20 }) });
    const findings = runRuleEngine(ctx);
    expect(findings.find((f) => f.ruleId === "CONDITION_001")).toBeUndefined();
  });
});
