import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { loadProjectWithAccess } from "../middleware/projectAccess";
import { requireApprovedSanction } from "../middleware/requireApprovedSanction";
import { upload } from "../middleware/upload";

import { createProject, getProject, listProjects, projectSummary, updateProject } from "../controllers/projectController";
import { createSanction, getSanction } from "../controllers/sanctionController";
import { createConditions, listConditions } from "../controllers/conditionController";
import { createMilestones, listMilestones } from "../controllers/milestoneController";
import { listProgress, submitProgress } from "../controllers/progressController";
import { listExpenditure, submitExpenditure } from "../controllers/expenditureController";
import { listSiteVisits, submitSiteVisit } from "../controllers/siteVisitController";
import { listEvidence, uploadEvidence } from "../controllers/evidenceController";
import { listDocuments, uploadDocument } from "../controllers/documentController";
import { analyzeProject, getProjectRisk, listFindings } from "../controllers/detectionController";
import { generateSummary, getSummary } from "../controllers/aiController";
import { listClarifications, requestClarification } from "../controllers/clarificationController";
import { listExceptions, requestException } from "../controllers/exceptionController";
import { resolveInvestigation } from "../controllers/investigationController";
import { getProjectAudit } from "../controllers/auditController";
import { importActivities, listActivities } from "../controllers/importController";

const router = Router();

router.use(authenticate);

router.post("/", createProject);
router.get("/", listProjects);
router.get("/summary", authorize("OFFICER"), projectSummary);

router.get("/:id", loadProjectWithAccess, getProject);
router.put("/:id", loadProjectWithAccess, updateProject);

router.post("/:id/sanction", loadProjectWithAccess, createSanction);
router.get("/:id/sanction", loadProjectWithAccess, getSanction);

router.post("/:id/conditions", loadProjectWithAccess, createConditions);
router.get("/:id/conditions", loadProjectWithAccess, listConditions);

router.post("/:id/milestones", loadProjectWithAccess, createMilestones);
router.get("/:id/milestones", loadProjectWithAccess, listMilestones);

router.post(
  "/:id/activities/import",
  loadProjectWithAccess,
  requireApprovedSanction,
  upload.single("file"),
  importActivities
);
router.get("/:id/activities", loadProjectWithAccess, listActivities);

router.post("/:id/progress", loadProjectWithAccess, submitProgress);
router.get("/:id/progress", loadProjectWithAccess, listProgress);

router.post("/:id/expenditure", loadProjectWithAccess, submitExpenditure);
router.get("/:id/expenditure", loadProjectWithAccess, listExpenditure);

router.post("/:id/site-visits", loadProjectWithAccess, submitSiteVisit);
router.get("/:id/site-visits", loadProjectWithAccess, listSiteVisits);

router.post("/:id/evidence", loadProjectWithAccess, upload.single("file"), uploadEvidence);
router.get("/:id/evidence", loadProjectWithAccess, listEvidence);

router.post("/:id/documents", loadProjectWithAccess, upload.single("file"), uploadDocument);
router.get("/:id/documents", loadProjectWithAccess, listDocuments);

// Findings/risk/ML/AI are officer-only intelligence — a contractor must never see them,
// enforced here at the API level (not just hidden in the UI).
router.post("/:id/analyze", loadProjectWithAccess, authorize("OFFICER"), analyzeProject);
router.get("/:id/findings", loadProjectWithAccess, authorize("OFFICER"), listFindings);
router.get("/:id/risk", loadProjectWithAccess, authorize("OFFICER"), getProjectRisk);

router.post("/:id/ai-summary", loadProjectWithAccess, authorize("OFFICER"), generateSummary);
router.get("/:id/ai-summary", loadProjectWithAccess, authorize("OFFICER"), getSummary);

router.post("/:id/clarification", loadProjectWithAccess, requestClarification);
router.get("/:id/clarification", loadProjectWithAccess, listClarifications);

router.post("/:id/exception", loadProjectWithAccess, requestException);
router.get("/:id/exception", loadProjectWithAccess, listExceptions);

router.post("/:id/resolve", loadProjectWithAccess, resolveInvestigation);

router.get("/:id/audit", loadProjectWithAccess, authorize("OFFICER"), getProjectAudit);

export default router;
