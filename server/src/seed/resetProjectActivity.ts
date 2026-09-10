/* eslint-disable no-console */
/**
 * Resets the activity-derived state of every CURRENT (CSV-imported) project back to a clean
 * baseline: actualProgress=0, spentAmount=0, and every downstream record (Progress,
 * Expenditure, SiteVisit, Evidence, Documents, Activity import history, Findings,
 * RiskAssessments, AIReports, Clarifications, ExceptionRequests) removed.
 *
 * Project, Sanction (kept APPROVED), Milestone, and contractor assignment are left untouched —
 * this is a "clear the test activity, keep the baseline" reset, not a full project wipe.
 */
import { connectDatabase, disconnectDatabase } from "../config/db";
import { Project } from "../models/Project";
import { Progress } from "../models/Progress";
import { Expenditure } from "../models/Expenditure";
import { SiteVisit } from "../models/SiteVisit";
import { Evidence } from "../models/Evidence";
import { ProjectDocument } from "../models/Document";
import { Finding } from "../models/Finding";
import { RiskAssessment } from "../models/RiskAssessment";
import { AIReport } from "../models/AIReport";
import { Clarification } from "../models/Clarification";
import { ExceptionRequest } from "../models/ExceptionRequest";
import { Activity } from "../models/Activity";

async function run() {
  await connectDatabase();

  const projects = await Project.find({ externalProjectId: { $exists: true, $ne: null } });
  if (projects.length === 0) {
    console.log("[reset] No CSV-imported projects found.");
    await disconnectDatabase();
    return;
  }

  for (const project of projects) {
    console.log(`[reset] Clearing activity for ${project.projectCode} (${project.name})`);
    const filter = { projectId: project._id };
    await Promise.all([
      Progress.deleteMany(filter),
      Expenditure.deleteMany(filter),
      SiteVisit.deleteMany(filter),
      Evidence.deleteMany(filter),
      ProjectDocument.deleteMany(filter),
      Finding.deleteMany(filter),
      RiskAssessment.deleteMany(filter),
      AIReport.deleteMany(filter),
      Clarification.deleteMany(filter),
      ExceptionRequest.deleteMany(filter),
      Activity.deleteMany(filter),
    ]);

    project.actualProgress = 0;
    project.spentAmount = 0;
    project.riskScore = 0;
    project.riskLevel = "LOW";
    project.priority = "LOW";
    await project.save();
  }

  console.log(`[reset] Done. ${projects.length} project(s) reset to a clean baseline.`);
  await disconnectDatabase();
}

run().catch((err) => {
  console.error("[reset] Failed:", err);
  process.exit(1);
});
