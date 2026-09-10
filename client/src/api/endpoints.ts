import { apiClient } from "./client";
import type {
  Activity,
  AIReport,
  AuditLogEntry,
  AuthUser,
  Clarification,
  Condition,
  Evidence,
  Expenditure,
  ExceptionRequest,
  Finding,
  ImportSummary,
  PendingSanction,
  Progress,
  Project,
  ProjectDocumentType,
  ProjectSummary,
  RiskAssessment,
  Sanction,
  SiteVisit,
} from "../types";

// ---- Auth ----
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<{ token: string; user: AuthUser }>("/auth/login", { email, password }).then((r) => r.data),
  register: (payload: { name: string; email: string; password: string; role: string; phone?: string }) =>
    apiClient.post<{ token: string; user: AuthUser }>("/auth/register", payload).then((r) => r.data),
  me: () => apiClient.get<{ user: AuthUser }>("/auth/me").then((r) => r.data.user),
};

// ---- Projects ----
export const projectApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<{ projects: Project[] }>("/projects", { params }).then((r) => r.data.projects),
  summary: () => apiClient.get<ProjectSummary>("/projects/summary").then((r) => r.data),
  get: (id: string) => apiClient.get<{ project: Project }>(`/projects/${id}`).then((r) => r.data.project),
  create: (payload: Partial<Project>) => apiClient.post<{ project: Project }>("/projects", payload).then((r) => r.data.project),
  update: (id: string, payload: Partial<Project>) =>
    apiClient.put<{ project: Project }>(`/projects/${id}`, payload).then((r) => r.data.project),
  highPriority: () => apiClient.get<{ projects: Project[] }>("/risk/high-priority").then((r) => r.data.projects),
};

// ---- Sanction ----
export const sanctionApi = {
  create: (projectId: string, payload: Partial<Sanction>) =>
    apiClient.post<{ sanction: Sanction }>(`/projects/${projectId}/sanction`, payload).then((r) => r.data.sanction),
  get: (projectId: string) =>
    apiClient.get<{ sanction: Sanction }>(`/projects/${projectId}/sanction`).then((r) => r.data.sanction).catch(() => null),
  pending: () => apiClient.get<{ sanctions: PendingSanction[] }>("/sanctions/pending").then((r) => r.data.sanctions),
  approve: (sanctionId: string) =>
    apiClient.post<{ sanction: Sanction }>(`/sanctions/${sanctionId}/approve`, {}).then((r) => r.data.sanction),
};

// ---- CSV Import ----
export const importApi = {
  projects: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient
      .post<ImportSummary<{ row: number; projectCode: string; contractorEmail: string; contractorCreated: boolean; contractorTempPassword?: string }>>(
        "/import/projects",
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      .then((r) => r.data);
  },
  activities: (projectId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient
      .post<ImportSummary<{ row: number; activityId: string; created: string[] }>>(
        `/projects/${projectId}/activities/import`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      .then((r) => r.data);
  },
};

// ---- Activities (daily-activity import history) ----
export const activityApi = {
  list: (projectId: string) => apiClient.get<{ activities: Activity[] }>(`/projects/${projectId}/activities`).then((r) => r.data.activities),
};

// ---- Conditions ----
export const conditionApi = {
  list: (projectId: string) =>
    apiClient.get<{ conditions: Condition[] }>(`/projects/${projectId}/conditions`).then((r) => r.data.conditions),
  create: (projectId: string, payload: Partial<Condition> | Partial<Condition>[]) =>
    apiClient.post(`/projects/${projectId}/conditions`, payload).then((r) => r.data),
};

// ---- Progress ----
export const progressApi = {
  list: (projectId: string) => apiClient.get<{ progress: Progress[] }>(`/projects/${projectId}/progress`).then((r) => r.data.progress),
  submit: (projectId: string, payload: Partial<Progress>) =>
    apiClient.post<{ progress: Progress }>(`/projects/${projectId}/progress`, payload).then((r) => r.data.progress),
};

// ---- Expenditure ----
export const expenditureApi = {
  list: (projectId: string) =>
    apiClient.get<{ expenditure: Expenditure[] }>(`/projects/${projectId}/expenditure`).then((r) => r.data.expenditure),
  submit: (projectId: string, payload: Partial<Expenditure>) =>
    apiClient.post<{ expenditure: Expenditure }>(`/projects/${projectId}/expenditure`, payload).then((r) => r.data.expenditure),
};

// ---- Site visits ----
export const siteVisitApi = {
  list: (projectId: string) => apiClient.get<{ visits: SiteVisit[] }>(`/projects/${projectId}/site-visits`).then((r) => r.data.visits),
  submit: (projectId: string, payload: Partial<SiteVisit>) =>
    apiClient.post<{ visit: SiteVisit }>(`/projects/${projectId}/site-visits`, payload).then((r) => r.data.visit),
};

// ---- Evidence ----
export const evidenceApi = {
  list: (projectId: string) => apiClient.get<{ evidence: Evidence[] }>(`/projects/${projectId}/evidence`).then((r) => r.data.evidence),
  upload: (projectId: string, file: File, meta: { latitude?: number; longitude?: number }) => {
    const form = new FormData();
    form.append("file", file);
    if (meta.latitude !== undefined) form.append("latitude", String(meta.latitude));
    if (meta.longitude !== undefined) form.append("longitude", String(meta.longitude));
    return apiClient
      .post<{ evidence: Evidence }>(`/projects/${projectId}/evidence`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data.evidence);
  },
};

// ---- Documents ----
export const documentApi = {
  list: (projectId: string) =>
    apiClient.get<{ documents: ProjectDocumentType[] }>(`/projects/${projectId}/documents`).then((r) => r.data.documents),
  upload: (projectId: string, file: File, meta: { type: string; amount?: number; invoiceNumber?: string; vendor?: string }) => {
    const form = new FormData();
    form.append("file", file);
    form.append("type", meta.type);
    if (meta.amount !== undefined) form.append("amount", String(meta.amount));
    if (meta.invoiceNumber) form.append("invoiceNumber", meta.invoiceNumber);
    if (meta.vendor) form.append("vendor", meta.vendor);
    return apiClient
      .post<{ document: ProjectDocumentType }>(`/projects/${projectId}/documents`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data.document);
  },
};

// ---- Detection / Findings / Risk ----
export const detectionApi = {
  analyze: (projectId: string) =>
    apiClient.post(`/projects/${projectId}/analyze`, {}).then((r) => r.data as { findings: Finding[]; riskScore: number; riskLevel: string; priority: string }),
  findings: (projectId: string) => apiClient.get<{ findings: Finding[] }>(`/projects/${projectId}/findings`).then((r) => r.data.findings),
  risk: (projectId: string) =>
    apiClient.get<{ latest: RiskAssessment | null; history: RiskAssessment[] }>(`/projects/${projectId}/risk`).then((r) => r.data),
};

// ---- AI ----
export const aiApi = {
  generate: (projectId: string) => apiClient.post<{ report: AIReport }>(`/projects/${projectId}/ai-summary`, {}).then((r) => r.data.report),
  get: (projectId: string) =>
    apiClient
      .get<{ report: AIReport | null }>(`/projects/${projectId}/ai-summary`)
      .then((r) => r.data.report)
      .catch(() => null),
};

// ---- Clarification ----
export const clarificationApi = {
  list: (projectId: string) =>
    apiClient.get<{ clarifications: Clarification[] }>(`/projects/${projectId}/clarification`).then((r) => r.data.clarifications),
  request: (projectId: string, payload: { findingIds: string[]; message: string; requiredDocuments?: string[] }) =>
    apiClient.post<{ clarification: Clarification }>(`/projects/${projectId}/clarification`, payload).then((r) => r.data.clarification),
  respond: (id: string, payload: { response: string }) =>
    apiClient.post<{ clarification: Clarification }>(`/clarification/${id}/respond`, payload).then((r) => r.data.clarification),
  review: (id: string, payload: { decision: string; resolutionNote?: string }) =>
    apiClient.post<{ clarification: Clarification }>(`/clarification/${id}/review`, payload).then((r) => r.data.clarification),
};

// ---- Exceptions ----
export const exceptionApi = {
  list: (projectId: string) =>
    apiClient.get<{ exceptions: ExceptionRequest[] }>(`/projects/${projectId}/exception`).then((r) => r.data.exceptions),
  request: (projectId: string, payload: { reason: string; ruleId?: string; requestedAdjustment?: number }) =>
    apiClient.post<{ exceptionRequest: ExceptionRequest }>(`/projects/${projectId}/exception`, payload).then((r) => r.data.exceptionRequest),
  review: (id: string, payload: { decision: "APPROVED" | "REJECTED"; reviewComment?: string }) =>
    apiClient.post<{ exceptionRequest: ExceptionRequest }>(`/exception/${id}/review`, payload).then((r) => r.data.exceptionRequest),
};

// ---- Investigation / Audit ----
export const investigationApi = {
  resolve: (projectId: string, payload: { findingId: string; status: "RESOLVED" | "DISMISSED"; resolutionNote: string }) =>
    apiClient.post(`/projects/${projectId}/resolve`, payload).then((r) => r.data),
  audit: (projectId: string) => apiClient.get<{ logs: AuditLogEntry[] }>(`/projects/${projectId}/audit`).then((r) => r.data.logs),
};
