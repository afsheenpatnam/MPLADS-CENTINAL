import request from "supertest";
import { createApp } from "../app";
import { clearTestDb, startTestDb, stopTestDb } from "../test-utils/testDb";

const app = createApp();

beforeAll(async () => {
  await startTestDb();
}, 60000);

afterAll(async () => {
  await stopTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

async function registerAndLogin(role: "OFFICER" | "CONTRACTOR", email: string) {
  const res = await request(app).post("/api/auth/register").send({
    name: `${role} User`,
    email,
    password: "password123",
    role,
  });
  return { token: res.body.token as string, id: res.body.user.id as string };
}

describe("End-to-end investigation flow", () => {
  it(
    "runs the full officer -> contractor -> detection -> clarification -> resolution -> audit flow",
    async () => {
      const officer = await registerAndLogin("OFFICER", "e2e.officer@mplad.local");
      const contractor = await registerAndLogin("CONTRACTOR", "e2e.contractor@mplad.local");

      // 1. Officer creates a project with a contractor assigned, deliberately shaped
      //    like the MAIN DEMO scenario: far along in time, low progress, high spend.
      const startDate = new Date(Date.now() - 330 * 24 * 60 * 60 * 1000);
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const createRes = await request(app)
        .post("/api/projects")
        .set("Authorization", `Bearer ${officer.token}`)
        .send({
          name: "E2E Rural Road Project",
          projectType: "Road Construction",
          state: "Test State",
          district: "Test District",
          location: "Test Village",
          latitude: 20,
          longitude: 78,
          sanctionedAmount: 5000000,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          approvedWork: "Construct rural road with side drains",
          approvedQuantity: 1000,
          contractorId: contractor.id,
        });
      expect(createRes.status).toBe(201);
      const projectId = createRes.body.project._id;

      // 2. Sanction
      const sanctionRes = await request(app)
        .post(`/api/projects/${projectId}/sanction`)
        .set("Authorization", `Bearer ${officer.token}`)
        .send({
          sanctionedAmount: 5000000,
          duration: 12,
          approvedWork: "Construct rural road with side drains",
          approvedQuantity: 1000,
          requiredVisits: 8,
        });
      expect(sanctionRes.status).toBe(201);

      // 3. Conditions
      const conditionRes = await request(app)
        .post(`/api/projects/${projectId}/conditions`)
        .set("Authorization", `Bearer ${officer.token}`)
        .send({
          ruleId: "CUSTOM_PROGRESS_FLOOR",
          category: "TIME_PROGRESS",
          parameter: "actualProgress",
          operator: ">=",
          expectedValue: 50,
          severity: "HIGH",
        });
      expect(conditionRes.status).toBe(201);

      // 3b. Contractor reviews and approves the sanction before any activity can be submitted
      const sanctionId = sanctionRes.body.sanction._id;
      const approveRes = await request(app)
        .post(`/api/sanctions/${sanctionId}/approve`)
        .set("Authorization", `Bearer ${contractor.token}`);
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.sanction.status).toBe("APPROVED");

      // 4. Contractor submits progress (low, despite high elapsed time)
      const progressRes = await request(app)
        .post(`/api/projects/${projectId}/progress`)
        .set("Authorization", `Bearer ${contractor.token}`)
        .send({
          date: new Date().toISOString(),
          physicalProgress: 20,
          reportedWork: "Partial excavation completed",
        });
      expect(progressRes.status).toBe(201);

      // 5. Contractor submits expenditure (90% of sanctioned amount)
      const expenditureRes = await request(app)
        .post(`/api/projects/${projectId}/expenditure`)
        .set("Authorization", `Bearer ${contractor.token}`)
        .send({
          date: new Date().toISOString(),
          amount: 4500000,
          category: "Materials & Labour",
        });
      expect(expenditureRes.status).toBe(201);

      // 6. Contractor records only 3 of the 8 required site visits
      for (let i = 0; i < 3; i++) {
        const visitRes = await request(app)
          .post(`/api/projects/${projectId}/site-visits`)
          .set("Authorization", `Bearer ${contractor.token}`)
          .send({ date: new Date().toISOString(), latitude: 20.0001, longitude: 78.0001 });
        expect(visitRes.status).toBe(201);
      }

      // 7. DETECTION — officer runs analysis
      const analyzeRes = await request(app)
        .post(`/api/projects/${projectId}/analyze`)
        .set("Authorization", `Bearer ${officer.token}`);
      expect(analyzeRes.status).toBe(200);
      expect(analyzeRes.body.findings.length).toBeGreaterThan(0);
      // This scenario only exercises FINANCIAL/TIME_PROGRESS/VISIT signals (no evidence
      // upload), so it should be clearly elevated above LOW but won't necessarily reach
      // the CRITICAL tier the seeded MAIN DEMO project (which layers in evidence, location,
      // and quantity findings too) reaches.
      expect(["MEDIUM", "HIGH", "CRITICAL"]).toContain(analyzeRes.body.riskLevel);

      // 8. FINDINGS
      const findingsRes = await request(app)
        .get(`/api/projects/${projectId}/findings`)
        .set("Authorization", `Bearer ${officer.token}`);
      expect(findingsRes.status).toBe(200);
      const costMismatch = findingsRes.body.findings.find((f: { ruleId: string }) => f.ruleId === "FINANCIAL_001");
      expect(costMismatch).toBeDefined();
      const visitViolation = findingsRes.body.findings.find((f: { ruleId: string }) => f.ruleId === "VISIT_001");
      expect(visitViolation).toBeDefined();

      // 9. RISK
      const riskRes = await request(app)
        .get(`/api/projects/${projectId}/risk`)
        .set("Authorization", `Bearer ${officer.token}`);
      expect(riskRes.status).toBe(200);
      expect(riskRes.body.latest.score).toBeGreaterThan(0);

      // 10. PRIORITY — should show up in high-priority list
      const highPriorityRes = await request(app)
        .get("/api/risk/high-priority")
        .set("Authorization", `Bearer ${officer.token}`);
      expect(highPriorityRes.status).toBe(200);
      expect(highPriorityRes.body.projects.some((p: { _id: string }) => p._id === projectId)).toBe(true);

      // 11. ASTRA SUMMARY — not configured in test env, must fail soft
      const aiRes = await request(app)
        .post(`/api/projects/${projectId}/ai-summary`)
        .set("Authorization", `Bearer ${officer.token}`);
      expect(aiRes.status).toBe(201);
      expect(aiRes.body.report.status).toBe("UNAVAILABLE");
      expect(aiRes.body.report.executiveSummary).toMatch(/temporarily unavailable/i);

      // 12. CLARIFICATION — officer requests, contractor responds
      const clarificationRes = await request(app)
        .post(`/api/projects/${projectId}/clarification`)
        .set("Authorization", `Bearer ${officer.token}`)
        .send({
          findingIds: [costMismatch._id],
          message: "Please explain the high expenditure relative to physical progress.",
          requiredDocuments: ["Measurement book extract"],
        });
      expect(clarificationRes.status).toBe(201);
      const clarificationId = clarificationRes.body.clarification._id;

      const findingAfterClarification = await request(app)
        .get(`/api/projects/${projectId}/findings`)
        .set("Authorization", `Bearer ${officer.token}`);
      expect(
        findingAfterClarification.body.findings.find((f: { _id: string }) => f._id === costMismatch._id).status
      ).toBe("CLARIFICATION_REQUESTED");

      const respondRes = await request(app)
        .post(`/api/clarification/${clarificationId}/respond`)
        .set("Authorization", `Bearer ${contractor.token}`)
        .send({ response: "Advance payment was made for bulk material procurement; work is progressing." });
      expect(respondRes.status).toBe(200);
      expect(respondRes.body.clarification.status).toBe("RESPONDED");

      // 13. OFFICER RESOLUTION
      const resolveRes = await request(app)
        .post(`/api/projects/${projectId}/resolve`)
        .set("Authorization", `Bearer ${officer.token}`)
        .send({
          findingId: costMismatch._id,
          status: "RESOLVED",
          resolutionNote: "Verified material procurement invoices; consistent with contractor explanation.",
        });
      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.finding.status).toBe("RESOLVED");

      // 14. AUDIT TRAIL — every major action should be recorded
      const auditRes = await request(app)
        .get(`/api/projects/${projectId}/audit`)
        .set("Authorization", `Bearer ${officer.token}`);
      expect(auditRes.status).toBe(200);
      const actions = auditRes.body.logs.map((l: { action: string }) => l.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          "PROJECT_CREATED",
          "SANCTION_CREATED",
          "CONDITION_CREATED",
          "PROGRESS_SUBMITTED",
          "EXPENDITURE_SUBMITTED",
          "SITE_VISIT_SUBMITTED",
          "ANOMALY_DETECTED",
          "RISK_UPDATED",
          "AI_REPORT_GENERATED",
          "CLARIFICATION_REQUESTED",
          "CLARIFICATION_RESPONDED",
          "INVESTIGATION_RESOLVED",
        ])
      );
    },
    60000
  );

  it("prevents a contractor from accessing a project they are not assigned to", async () => {
    const officer = await registerAndLogin("OFFICER", "iso.officer@mplad.local");
    const outsider = await registerAndLogin("CONTRACTOR", "iso.outsider@mplad.local");

    const createRes = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${officer.token}`)
      .send({
        name: "Isolation Test Project",
        projectType: "Road Construction",
        state: "Test State",
        district: "Test District",
        location: "Test Village",
        latitude: 20,
        longitude: 78,
        sanctionedAmount: 1000000,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });

    const projectId = createRes.body.project._id;
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(res.status).toBe(403);
  });

  it("blocks a CONTRACTOR from officer-only intelligence even on their own assigned project", async () => {
    const officer = await registerAndLogin("OFFICER", "intel.officer@mplad.local");
    const contractor = await registerAndLogin("CONTRACTOR", "intel.contractor@mplad.local");

    const createRes = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${officer.token}`)
      .send({
        name: "Officer Intel Isolation Project",
        projectType: "Road Construction",
        state: "Test State",
        district: "Test District",
        location: "Test Village",
        latitude: 20,
        longitude: 78,
        sanctionedAmount: 1000000,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        contractorId: contractor.id,
      });
    const projectId = createRes.body.project._id;

    const findingsRes = await request(app)
      .get(`/api/projects/${projectId}/findings`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(findingsRes.status).toBe(403);

    const riskRes = await request(app)
      .get(`/api/projects/${projectId}/risk`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(riskRes.status).toBe(403);

    const aiRes = await request(app)
      .get(`/api/projects/${projectId}/ai-summary`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(aiRes.status).toBe(403);

    const auditRes = await request(app)
      .get(`/api/projects/${projectId}/audit`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(auditRes.status).toBe(403);

    const analyzeRes = await request(app)
      .post(`/api/projects/${projectId}/analyze`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(analyzeRes.status).toBe(403);
  });
});
