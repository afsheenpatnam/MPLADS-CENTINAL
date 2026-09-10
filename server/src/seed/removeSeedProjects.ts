/* eslint-disable no-console */
/**
 * One-off cleanup: removes all projects that were NOT created via CSV import (i.e. every
 * project lacking `externalProjectId`), along with every child record scoped to those
 * projects. CSV-imported projects (and the users referencing them) are left untouched.
 *
 * This does not touch User accounts — demo login credentials (officer@mplad.local etc.) stay
 * valid even after their seeded example projects are removed.
 */
import { connectDatabase, disconnectDatabase } from "../config/db";
import { Project } from "../models/Project";
import { Sanction } from "../models/Sanction";
import { Condition } from "../models/Condition";
import { Milestone } from "../models/Milestone";
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
import { AuditLog } from "../models/AuditLog";
import { Activity } from "../models/Activity";

async function run() {
  await connectDatabase();

  const seededProjects = await Project.find({
    $or: [{ externalProjectId: { $exists: false } }, { externalProjectId: null }],
  }).select("_id projectCode name");

  if (seededProjects.length === 0) {
    console.log("[cleanup] No seeded/mock projects found — nothing to remove.");
    await disconnectDatabase();
    return;
  }

  const ids = seededProjects.map((p) => p._id);
  console.log(`[cleanup] Removing ${ids.length} seeded/mock project(s):`);
  seededProjects.forEach((p) => console.log(`  - ${p.projectCode} ${p.name}`));

  const filter = { projectId: { $in: ids } };
  await Promise.all([
    Sanction.deleteMany(filter),
    Condition.deleteMany(filter),
    Milestone.deleteMany(filter),
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
    AuditLog.deleteMany(filter),
    Activity.deleteMany(filter),
  ]);

  await Project.deleteMany({ _id: { $in: ids } });

  const remaining = await Project.find({}).select("projectCode name externalProjectId");
  console.log(`[cleanup] Done. ${remaining.length} project(s) remain:`);
  remaining.forEach((p) => console.log(`  - ${p.projectCode} ${p.name} (${p.externalProjectId})`));

  await disconnectDatabase();
}

run().catch((err) => {
  console.error("[cleanup] Failed:", err);
  process.exit(1);
});
