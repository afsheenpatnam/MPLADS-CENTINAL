import fs from "fs";
import path from "path";
import { Project } from "../../models/Project";
import { Sanction } from "../../models/Sanction";
import { Activity } from "../../models/Activity";
import { Progress } from "../../models/Progress";
import { Expenditure } from "../../models/Expenditure";
import { SiteVisit } from "../../models/SiteVisit";
import { Finding } from "../../models/Finding";
import { User } from "../../models/User";
import { importProjectCsv } from "./projectImportService";
import { importActivityCsv } from "./activityImportService";
import { clearTestDb, startTestDb, stopTestDb } from "../../test-utils/testDb";
import { JwtPayload } from "../../utils/jwt";

const SAMPLES_DIR = path.resolve(__dirname, "../../../../samples");

beforeAll(async () => {
  await startTestDb();
}, 60000);

afterAll(async () => {
  await stopTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

async function makeOfficer(): Promise<JwtPayload> {
  const officer = await User.create({
    name: "Test Officer",
    email: "officer.csv@mplad.local",
    passwordHash: "x",
    role: "OFFICER",
  });
  return { userId: officer._id.toString(), role: "OFFICER", email: officer.email };
}

describe("importProjectCsv", () => {
  it("imports the anomaly-demo sample: creates a project, a PENDING_APPROVAL sanction, and a new contractor", async () => {
    const officer = await makeOfficer();
    const buffer = fs.readFileSync(path.join(SAMPLES_DIR, "officer_projects_anomaly_demo.csv"));

    const summary = await importProjectCsv(buffer, officer);

    expect(summary.invalidRows).toHaveLength(0);
    expect(summary.validRows).toBe(1);
    expect(summary.results[0].contractorCreated).toBe(true);
    expect(summary.results[0].contractorTempPassword).toBeDefined();

    const project = await Project.findById(summary.results[0].projectId);
    expect(project).not.toBeNull();
    expect(project!.externalProjectId).toBe("PRJ-DEMO-001");
    expect(project!.status).toBe("PLANNED");

    const sanction = await Sanction.findOne({ projectId: project!._id });
    expect(sanction!.status).toBe("PENDING_APPROVAL");
    expect(sanction!.requiredVisits).toBeGreaterThan(50); // 2/week over ~11 months
  });

  it("skips a row whose project_id was already imported", async () => {
    const officer = await makeOfficer();
    const buffer = fs.readFileSync(path.join(SAMPLES_DIR, "officer_projects_clean.csv"));

    const first = await importProjectCsv(buffer, officer);
    expect(first.validRows).toBe(1);

    const second = await importProjectCsv(buffer, officer);
    expect(second.validRows).toBe(0);
    expect(second.warnings.some((w) => w.message.includes("already imported"))).toBe(true);

    const count = await Project.countDocuments({ externalProjectId: "PRJ-CLEAN-001" });
    expect(count).toBe(1);
  });

  it("rejects a row with missing required fields instead of silently skipping it", async () => {
    const officer = await makeOfficer();
    const badCsv = Buffer.from(
      "project_id,project_name,project_type,state,district,location,latitude,longitude,contractor_name,contractor_email,sanctioned_amount,start_date,end_date,approved_work_description\n" +
        "PRJ-BAD-001,,Road,State,District,Loc,20,78,Some Contractor,bad-email,1000000,2026-01-01,2026-12-01,Some work\n"
    );

    const summary = await importProjectCsv(badCsv, officer);
    expect(summary.validRows).toBe(0);
    expect(summary.invalidRows.length).toBeGreaterThan(0);
  });
});

describe("importActivityCsv", () => {
  async function importDemoProject(officer: JwtPayload) {
    const buffer = fs.readFileSync(path.join(SAMPLES_DIR, "officer_projects_anomaly_demo.csv"));
    const summary = await importProjectCsv(buffer, officer);
    const project = (await Project.findById(summary.results[0].projectId))!;
    const sanction = (await Sanction.findOne({ projectId: project._id }))!;
    sanction.status = "APPROVED";
    await sanction.save();
    project.status = "ACTIVE";
    await project.save();
    return project;
  }

  it("fans the anomaly-demo activity CSV into Progress/Expenditure/SiteVisit and triggers detection", async () => {
    const officer = await makeOfficer();
    const project = await importDemoProject(officer);
    const contractor: JwtPayload = { userId: project.contractorId!.toString(), role: "CONTRACTOR", email: "x@x.com" };

    const buffer = fs.readFileSync(path.join(SAMPLES_DIR, "contractor_daily_activity_anomaly_demo.csv"));
    const summary = await importActivityCsv(buffer, project, contractor);

    expect(summary.invalidRows).toHaveLength(0);
    expect(summary.validRows).toBe(5);

    const progressCount = await Progress.countDocuments({ projectId: project._id });
    const expenditureCount = await Expenditure.countDocuments({ projectId: project._id });
    const visitCount = await SiteVisit.countDocuments({ projectId: project._id });
    expect(progressCount).toBe(5);
    expect(expenditureCount).toBe(5);
    expect(visitCount).toBe(3);

    const updatedProject = await Project.findById(project._id);
    expect(updatedProject!.actualProgress).toBe(20);
    expect(updatedProject!.spentAmount).toBe(4500000); // 90% of 5,000,000 sanctioned

    expect(summary.detection).toBeDefined();
    const findingTypes = summary.detection!.findings.map((f) => f.ruleId);
    expect(findingTypes).toContain("FINANCIAL_001"); // cost-progress mismatch
    expect(findingTypes).toContain("VISIT_001"); // visit shortfall
    expect(findingTypes).toContain("QUANTITY_001"); // quantity deviation
    expect(findingTypes).toContain("FINANCIAL_003"); // missing justification
    expect(findingTypes).toContain("FINANCIAL_004"); // duplicate invoice

    const findings = await Finding.find({ projectId: project._id });
    expect(findings.length).toBeGreaterThan(0);
  });

  it("is idempotent: re-uploading the same CSV does not duplicate activities", async () => {
    const officer = await makeOfficer();
    const project = await importDemoProject(officer);
    const contractor: JwtPayload = { userId: project.contractorId!.toString(), role: "CONTRACTOR", email: "x@x.com" };
    const buffer = fs.readFileSync(path.join(SAMPLES_DIR, "contractor_daily_activity_anomaly_demo.csv"));

    await importActivityCsv(buffer, project, contractor);
    const secondRun = await importActivityCsv(buffer, project, contractor);

    expect(secondRun.validRows).toBe(0);
    expect(secondRun.warnings.every((w) => w.message.includes("already imported"))).toBe(true);

    const activityCount = await Activity.countDocuments({ projectId: project._id });
    expect(activityCount).toBe(5);
  });

  it("does not fire cost/budget findings for a proportionally-spent, in-budget project", async () => {
    const officer = await makeOfficer();
    const buffer = fs.readFileSync(path.join(SAMPLES_DIR, "officer_projects_clean.csv"));
    const projSummary = await importProjectCsv(buffer, officer);
    const project = (await Project.findById(projSummary.results[0].projectId))!;
    const sanction = (await Sanction.findOne({ projectId: project._id }))!;
    sanction.status = "APPROVED";
    await sanction.save();

    // Backdate the project so "today" sits inside its window at a modest elapsed percentage,
    // matching the normal activity CSV's steady pace.
    project.startDate = new Date(Date.now() - 130 * 24 * 60 * 60 * 1000);
    project.endDate = new Date(Date.now() + 230 * 24 * 60 * 60 * 1000);
    project.status = "ACTIVE";
    await project.save();

    const contractor: JwtPayload = { userId: project.contractorId!.toString(), role: "CONTRACTOR", email: "x@x.com" };
    const activityBuffer = fs.readFileSync(path.join(SAMPLES_DIR, "contractor_daily_activity_normal.csv"));
    const summary = await importActivityCsv(activityBuffer, project, contractor);

    // This sample only covers a few months of a longer project (no full-year visit cadence and
    // no separately-uploaded photo evidence), so WORK_001/VISIT_001 legitimately still fire —
    // what this asserts is that proportional, in-budget, non-duplicated spending does NOT
    // trigger the financial fraud-risk indicators.
    const findingTypes = summary.detection!.findings.map((f) => f.ruleId);
    expect(findingTypes).not.toContain("FINANCIAL_001");
    expect(findingTypes).not.toContain("FINANCIAL_004");
    expect(findingTypes).not.toContain("SANCTION_001");
  });
});

describe("sanction approval gate", () => {
  it("rejects activity import before the sanction is approved", async () => {
    const officer = await makeOfficer();
    const buffer = fs.readFileSync(path.join(SAMPLES_DIR, "officer_projects_clean.csv"));
    const projSummary = await importProjectCsv(buffer, officer);
    const project = (await Project.findById(projSummary.results[0].projectId))!;
    // Sanction left PENDING_APPROVAL deliberately.

    // The service itself doesn't enforce the gate (that's the controller's job via
    // assertSanctionApproved) — verify the guard function directly here.
    const { assertSanctionApproved } = await import("../sanction/sanctionGuard");
    await expect(assertSanctionApproved(project._id)).rejects.toThrow(/must be approved/);

    // Sanity: once approved, the same check passes.
    const sanction = (await Sanction.findOne({ projectId: project._id }))!;
    sanction.status = "APPROVED";
    await sanction.save();
    await expect(assertSanctionApproved(project._id)).resolves.toBeUndefined();
  });
});
