import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { Milestone } from "../../models/Milestone";
import { Project } from "../../models/Project";
import { Sanction } from "../../models/Sanction";
import { parseCsvBuffer } from "../csv/csvParser";
import { ImportSummary, RowIssue, parseBoolean } from "../csv/importTypes";
import { findOrCreateContractor } from "./contractorLookup";
import { recordAudit } from "../audit/auditService";
import { JwtPayload } from "../../utils/jwt";

const rowSchema = z.object({
  project_id: z.string().optional(),
  project_name: z.string().min(2, "project_name is required"),
  project_type: z.string().min(1, "project_type is required"),
  state: z.string().min(1, "state is required"),
  district: z.string().min(1, "district is required"),
  location: z.string().min(1, "location is required"),
  latitude: z.coerce.number({ invalid_type_error: "latitude must be a number" }),
  longitude: z.coerce.number({ invalid_type_error: "longitude must be a number" }),
  beneficiary_description: z.string().optional().default(""),
  contractor_name: z.string().min(2, "contractor_name is required"),
  contractor_email: z.string().email("contractor_email must be a valid email"),
  contractor_phone: z.string().optional(),
  sanctioned_amount: z.coerce.number().positive("sanctioned_amount must be positive"),
  released_amount: z.coerce.number().optional().default(0),
  start_date: z.coerce.date({ invalid_type_error: "start_date must be a valid date" }),
  end_date: z.coerce.date({ invalid_type_error: "end_date must be a valid date" }),
  expected_progress_percent: z.coerce.number().optional(),
  approved_work_description: z.string().min(2, "approved_work_description is required"),
  planned_quantity: z.coerce.number().optional().default(0),
  quantity_unit: z.string().optional().default(""),
  approved_materials: z.string().optional().default(""),
  required_site_visits_per_week: z.coerce.number().optional().default(1),
  progress_reporting_frequency_days: z.coerce.number().optional().default(7),
  evidence_required: z.string().optional(),
  milestone_1_date: z.string().optional(),
  milestone_1_expected_progress: z.string().optional(),
  milestone_2_date: z.string().optional(),
  milestone_2_expected_progress: z.string().optional(),
  milestone_3_date: z.string().optional(),
  milestone_3_expected_progress: z.string().optional(),
  expenditure_justification_required: z.string().optional(),
  notes: z.string().optional().default(""),
});

export interface ProjectImportResult {
  row: number;
  projectId: string;
  projectCode: string;
  contractorEmail: string;
  contractorCreated: boolean;
  contractorTempPassword?: string;
}

export async function importProjectCsv(
  buffer: Buffer,
  officer: JwtPayload
): Promise<ImportSummary<ProjectImportResult>> {
  const rawRows = parseCsvBuffer(buffer);
  const invalidRows: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const results: ProjectImportResult[] = [];
  const importBatchId = uuidv4();

  let projectCounter = await Project.countDocuments();

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

    if (data.end_date <= data.start_date) {
      invalidRows.push({ row: rowNum, field: "end_date", message: "end_date must be after start_date" });
      continue;
    }

    if (data.project_id) {
      const existingProject = await Project.findOne({ externalProjectId: data.project_id });
      if (existingProject) {
        warnings.push({ row: rowNum, field: "project_id", message: `project_id ${data.project_id} already imported — skipped` });
        continue;
      }
    }

    let contractorResult;
    try {
      contractorResult = await findOrCreateContractor({
        name: data.contractor_name,
        email: data.contractor_email,
        phone: data.contractor_phone,
      });
    } catch (err) {
      invalidRows.push({ row: rowNum, field: "contractor_email", message: err instanceof Error ? err.message : "Failed to resolve contractor" });
      continue;
    }

    projectCounter += 1;
    const projectCode = `MPLAD-${new Date().getFullYear()}-${String(projectCounter).padStart(4, "0")}`;

    const project = await Project.create({
      projectCode,
      externalProjectId: data.project_id,
      name: data.project_name,
      description: [data.beneficiary_description, data.notes].filter(Boolean).join(" — "),
      projectType: data.project_type,
      state: data.state,
      district: data.district,
      location: data.location,
      latitude: data.latitude,
      longitude: data.longitude,
      officerId: officer.userId,
      contractorId: contractorResult.user._id,
      sanctionedAmount: data.sanctioned_amount,
      releasedAmount: data.released_amount || data.sanctioned_amount * 0.9,
      startDate: data.start_date,
      endDate: data.end_date,
      approvedWork: data.approved_work_description,
      approvedQuantity: data.planned_quantity,
      quantityUnit: data.quantity_unit,
      approvedMaterials: data.approved_materials,
      expectedProgress: data.expected_progress_percent ?? 0,
      status: "PLANNED",
    });

    const durationMonths = Math.max(
      1,
      Math.round((data.end_date.getTime() - data.start_date.getTime()) / (30 * 24 * 60 * 60 * 1000))
    );
    const durationWeeks = Math.max(1, Math.ceil((data.end_date.getTime() - data.start_date.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    const requiredVisits = Math.max(1, Math.round(data.required_site_visits_per_week * durationWeeks));

    await Sanction.create({
      projectId: project._id,
      sanctionedAmount: data.sanctioned_amount,
      duration: durationMonths,
      approvedWork: data.approved_work_description,
      approvedQuantity: data.planned_quantity,
      approvedMaterials: data.approved_materials,
      financialConditions: data.expenditure_justification_required
        ? ["Expenditure above the configured threshold requires justification and supporting documents"]
        : [],
      timelineConditions: [`Work to be completed within ${durationMonths} month(s)`],
      workConditions: [],
      evidenceConditions: parseBoolean(data.evidence_required, true) ? ["Geo-tagged evidence required for progress updates"] : [],
      visitConditions: [`Minimum ${data.required_site_visits_per_week} site visit(s) per week required`],
      otherConditions: [],
      requiredVisits,
      reportingFrequencyDays: data.progress_reporting_frequency_days,
      evidenceRequired: parseBoolean(data.evidence_required, true),
      expenditureJustificationRequired: parseBoolean(data.expenditure_justification_required, true),
      status: "PENDING_APPROVAL",
      createdBy: officer.userId,
    });

    const milestones: { name: string; expectedDate: string | undefined; expectedProgress: string | undefined }[] = [
      { name: "Milestone 1", expectedDate: data.milestone_1_date, expectedProgress: data.milestone_1_expected_progress },
      { name: "Milestone 2", expectedDate: data.milestone_2_date, expectedProgress: data.milestone_2_expected_progress },
      { name: "Milestone 3", expectedDate: data.milestone_3_date, expectedProgress: data.milestone_3_expected_progress },
    ];
    for (const m of milestones) {
      if (!m.expectedDate) continue;
      const date = new Date(m.expectedDate);
      const progress = Number(m.expectedProgress ?? 0);
      if (Number.isNaN(date.getTime()) || Number.isNaN(progress)) {
        warnings.push({ row: rowNum, field: m.name, message: `${m.name} has an invalid date/progress and was skipped` });
        continue;
      }
      await Milestone.create({ projectId: project._id, name: m.name, expectedDate: date, expectedProgress: progress });
    }

    if (contractorResult.created) {
      warnings.push({
        row: rowNum,
        field: "contractor_email",
        message: `New contractor account created for ${data.contractor_email} — temporary password: ${contractorResult.tempPassword}`,
      });
    }

    await recordAudit({
      user: officer,
      action: "PROJECT_CREATED",
      entity: "Project",
      entityId: project._id,
      projectId: project._id,
      newValue: { source: "CSV_IMPORT", importBatchId, projectCode },
    });
    await recordAudit({
      user: officer,
      action: "SANCTION_CREATED",
      entity: "Sanction",
      projectId: project._id,
      newValue: { source: "CSV_IMPORT", importBatchId },
    });

    results.push({
      row: rowNum,
      projectId: project._id.toString(),
      projectCode,
      contractorEmail: data.contractor_email,
      contractorCreated: contractorResult.created,
      contractorTempPassword: contractorResult.tempPassword,
    });
  }

  return {
    totalRows: rawRows.length,
    validRows: results.length,
    invalidRows,
    warnings,
    results,
    importBatchId,
  };
}
