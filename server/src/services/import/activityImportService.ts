import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { Activity } from "../../models/Activity";
import { Expenditure } from "../../models/Expenditure";
import { IProject } from "../../models/Project";
import { Progress } from "../../models/Progress";
import { SiteVisit } from "../../models/SiteVisit";
import { parseCsvBuffer } from "../csv/csvParser";
import { ImportSummary, RowIssue } from "../csv/importTypes";
import { recordAudit } from "../audit/auditService";
import { JwtPayload } from "../../utils/jwt";
import { runDetectionPipeline, DetectionRunResult } from "../detection/detectionPipeline";
import { emitToUser } from "../../realtime/socketServer";

const rowSchema = z.object({
  activity_id: z.string().min(1, "activity_id is required for idempotency"),
  project_id: z.string().optional(),
  activity_date: z.coerce.date({ invalid_type_error: "activity_date must be a valid date" }),
  progress_percent: z.coerce.number().min(0).max(100).optional(),
  work_completed_description: z.string().optional(),
  quantity_completed: z.coerce.number().optional(),
  quantity_unit: z.string().optional(),
  expenditure_amount: z.coerce.number().positive().optional(),
  expenditure_category: z.string().optional(),
  invoice_number: z.string().optional(),
  vendor_name: z.string().optional(),
  expenditure_justification: z.string().optional(),
  site_visit_date: z.string().optional(),
  site_visit_latitude: z.coerce.number().optional(),
  site_visit_longitude: z.coerce.number().optional(),
  evidence_file_names: z.string().optional(),
  remarks: z.string().optional(),
});

export interface ActivityImportRowResult {
  row: number;
  activityId: string;
  created: string[]; // e.g. ["progress", "expenditure", "siteVisit"]
}

export async function importActivityCsv(
  buffer: Buffer,
  project: IProject,
  contractor: JwtPayload
): Promise<ImportSummary<ActivityImportRowResult> & { detection?: DetectionRunResult }> {
  const rawRows = parseCsvBuffer(buffer);
  const invalidRows: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const results: ActivityImportRowResult[] = [];
  const importBatchId = uuidv4();

  let anyRowProcessed = false;

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 1;
    const raw = rawRows[i];
    const parsed = rowSchema.safeParse(raw);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        invalidRows.push({ row: rowNum, field: issue.path.join("."), message: issue.message });
      }
      continue;
    }
    const data = parsed.data;

    if (data.project_id && data.project_id !== project.projectCode && data.project_id !== project._id.toString()) {
      warnings.push({
        row: rowNum,
        field: "project_id",
        message: `Row references project_id "${data.project_id}" which does not match the target project (${project.projectCode}) — imported against the target project anyway`,
      });
    }

    // Idempotency: skip a row whose activity_id was already imported for this project.
    const existing = await Activity.findOne({ projectId: project._id, activityId: data.activity_id });
    if (existing) {
      warnings.push({ row: rowNum, field: "activity_id", message: `activity_id "${data.activity_id}" already imported — skipped` });
      continue;
    }

    const created: string[] = [];
    let progressId, expenditureId, siteVisitId;

    if (data.progress_percent !== undefined) {
      const progress = await Progress.create({
        projectId: project._id,
        submittedBy: contractor.userId,
        date: data.activity_date,
        physicalProgress: data.progress_percent,
        reportedWork: data.work_completed_description || "Daily activity import",
        reportedQuantity: data.quantity_completed,
        remarks: data.remarks,
      });
      progressId = progress._id;
      created.push("progress");
      if (data.progress_percent > project.actualProgress) {
        project.actualProgress = data.progress_percent;
      }
    }

    if (data.expenditure_amount !== undefined) {
      const expenditure = await Expenditure.create({
        projectId: project._id,
        submittedBy: contractor.userId,
        date: data.activity_date,
        amount: data.expenditure_amount,
        category: data.expenditure_category || "Uncategorized",
        invoiceNumber: data.invoice_number,
        vendor: data.vendor_name,
        justification: data.expenditure_justification,
      });
      expenditureId = expenditure._id;
      created.push("expenditure");
      project.spentAmount += data.expenditure_amount;
    }

    if (data.site_visit_date && data.site_visit_latitude !== undefined && data.site_visit_longitude !== undefined) {
      const siteVisitDate = new Date(data.site_visit_date);
      if (!Number.isNaN(siteVisitDate.getTime())) {
        const visit = await SiteVisit.create({
          projectId: project._id,
          contractorId: contractor.userId,
          date: siteVisitDate,
          latitude: data.site_visit_latitude,
          longitude: data.site_visit_longitude,
          remarks: data.remarks,
          status: "COMPLETED",
        });
        siteVisitId = visit._id;
        created.push("siteVisit");
      } else {
        warnings.push({ row: rowNum, field: "site_visit_date", message: "site_visit_date was invalid — site visit not recorded" });
      }
    }

    const evidenceFileNames = (data.evidence_file_names ?? "")
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (evidenceFileNames.length > 0) {
      warnings.push({
        row: rowNum,
        field: "evidence_file_names",
        message: `References ${evidenceFileNames.length} evidence file(s) (${evidenceFileNames.join(", ")}) — these must still be uploaded via the Evidence tab; a CSV cannot carry image bytes`,
      });
    }

    await Activity.create({
      projectId: project._id,
      activityId: data.activity_id,
      submittedBy: contractor.userId,
      activityDate: data.activity_date,
      progressPercent: data.progress_percent,
      workCompletedDescription: data.work_completed_description,
      quantityCompleted: data.quantity_completed,
      quantityUnit: data.quantity_unit,
      expenditureAmount: data.expenditure_amount,
      expenditureCategory: data.expenditure_category,
      invoiceNumber: data.invoice_number,
      vendorName: data.vendor_name,
      expenditureJustification: data.expenditure_justification,
      siteVisitDate: data.site_visit_date ? new Date(data.site_visit_date) : undefined,
      siteVisitLatitude: data.site_visit_latitude,
      siteVisitLongitude: data.site_visit_longitude,
      evidenceFileNames,
      remarks: data.remarks,
      progressId,
      expenditureId,
      siteVisitId,
      importBatchId,
    });

    anyRowProcessed = true;
    results.push({ row: rowNum, activityId: data.activity_id, created });
  }

  await project.save();

  await recordAudit({
    user: contractor,
    action: "PROGRESS_SUBMITTED",
    entity: "Activity",
    projectId: project._id,
    newValue: { source: "CSV_IMPORT", importBatchId, rowsImported: results.length },
  });

  emitToUser(contractor.userId, "activity:imported", {
    projectId: project._id.toString(),
    importBatchId,
    rowsImported: results.length,
    rowsSkipped: warnings.length,
    rowsInvalid: invalidRows.length,
  });
  emitToUser(project.officerId.toString(), "activity:imported", {
    projectId: project._id.toString(),
    projectCode: project.projectCode,
    importBatchId,
    rowsImported: results.length,
  });

  // Run the full detection pipeline once, after all rows are applied — this is what
  // recalculates risk/priority and pushes the officer-only real-time update.
  let detection: DetectionRunResult | undefined;
  if (anyRowProcessed) {
    detection = await runDetectionPipeline(project._id, contractor);
  }

  emitToUser(contractor.userId, "processing:completed", { projectId: project._id.toString(), importBatchId });

  return {
    totalRows: rawRows.length,
    validRows: results.length,
    invalidRows,
    warnings,
    results,
    importBatchId,
    detection,
  };
}
