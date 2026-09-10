# API Reference

Base URL: `http://localhost:5000/api`. All routes except `/auth/register` and `/auth/login`
require `Authorization: Bearer <token>`. Routes nested under `/projects/:id/*` also enforce
role-based project access (see `docs/ARCHITECTURE.md`).

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{ name, email, password, role, phone?, department? }` | `role` ∈ OFFICER/CONTRACTOR |
| POST | `/auth/login` | `{ email, password }` | Returns `{ token, user }` |
| GET | `/auth/me` | — | Current user from token |

## CSV Import

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/import/projects` | OFFICER | `multipart/form-data`, field `file` — creates project(s) + sanction(s) (`PENDING_APPROVAL`) + contractor(s); see `docs/CSV_FORMATS.md` |
| POST | `/projects/:id/activities/import` | CONTRACTOR, sanction must be `APPROVED` | `multipart/form-data`, field `file` — idempotent by `activity_id`; auto-runs detection on success |
| GET | `/projects/:id/activities` | scoped | Import history for the "Data Import" tab |

## Sanctions

| Method | Path | Role | Notes |
|---|---|---|---|
| POST / GET | `/projects/:id/sanction` | OFFICER creates, any scoped role reads | |
| GET | `/sanctions/pending` | CONTRACTOR | Sanctions awaiting this contractor's approval, across all their projects |
| POST | `/sanctions/:id/approve` | CONTRACTOR (assigned to that project) | Flips status to `APPROVED`; unblocks progress/expenditure/site-visit/evidence/activity submission for that project |

## Projects

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/projects` | OFFICER | Creates project, auto-generates `projectCode` |
| GET | `/projects` | any | Scoped: officer sees own, contractor sees assigned; risk/priority fields are stripped from the response for CONTRACTOR (see `serializeProject` in `projectController.ts`); supports `?district=&contractorId=&projectType=&riskLevel=&status=&from=&to=` |
| GET | `/projects/summary` | **OFFICER only** | KPI counts for the dashboard |
| GET | `/projects/:id` | scoped | Full project doc, populated officer/contractor; risk/priority stripped for CONTRACTOR |
| PUT | `/projects/:id` | OFFICER | Partial update |

## Conditions / Milestones

| Method | Path | Role |
|---|---|---|
| POST / GET | `/projects/:id/conditions` | OFFICER creates (single or array), any reads |
| POST / GET | `/projects/:id/milestones` | OFFICER creates, any reads |

## Contractor submissions

All POST routes below (except reads) require the project's sanction to be `APPROVED` — see
`requireApprovedSanction` middleware.

| Method | Path | Role |
|---|---|---|
| POST / GET | `/projects/:id/progress` | CONTRACTOR submits, any reads |
| POST / GET | `/projects/:id/expenditure` | CONTRACTOR submits, any reads |
| POST / GET | `/projects/:id/site-visits` | CONTRACTOR submits, any reads |
| POST / GET | `/projects/:id/evidence` | CONTRACTOR uploads (`multipart/form-data`, field `file`), any reads |
| POST / GET | `/projects/:id/documents` | CONTRACTOR uploads (`multipart/form-data`, field `file`), any reads |

## Detection / Risk

All routes below are **OFFICER-only** — this is officer intelligence a contractor must never
receive, enforced with `authorize("OFFICER")` on the route, not just hidden in the UI.

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/projects/:id/analyze` | OFFICER | Runs the full detection pipeline, returns findings + risk + priority |
| GET | `/projects/:id/findings` | OFFICER | `?status=&category=&severity=` filters |
| GET | `/projects/:id/risk` | OFFICER | Latest + last 20 `RiskAssessment` records, incl. `mlFeatures`/`mlNormalizedScore`/`mlDominantSignals` |
| GET | `/risk/high-priority` | OFFICER | Projects with `priority` HIGH/CRITICAL, scoped |

## AI (Astra)

| Method | Path | Role |
|---|---|---|
| POST | `/projects/:id/ai-summary` | OFFICER — generates a new report (or an "unavailable" stub) |
| GET | `/projects/:id/ai-summary` | OFFICER — latest report |

## Clarification / Exception / Investigation / Audit

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/projects/:id/clarification` | OFFICER | `{ findingIds[], message, requiredDocuments?, deadline? }` |
| GET | `/projects/:id/clarification` | scoped | |
| POST | `/clarification/:id/respond` | CONTRACTOR | `{ response }` |
| POST | `/clarification/:id/review` | OFFICER | `{ decision: ACCEPT\|NEEDS_MORE_INFO\|RESOLVE, resolutionNote? }` |
| POST | `/projects/:id/exception` | CONTRACTOR | `{ reason, ruleId?, requestedAdjustment?, supportingDocuments? }` |
| GET | `/projects/:id/exception` | scoped | |
| POST | `/exception/:id/review` | OFFICER | `{ decision: APPROVED\|REJECTED, reviewComment? }` |
| POST | `/projects/:id/resolve` | OFFICER | `{ findingId, status: RESOLVED\|DISMISSED, resolutionNote }` |
| GET | `/projects/:id/audit` | OFFICER | Last 500 audit events for the project |

## Finding object shape

```jsonc
{
  "_id": "...",
  "projectId": "...",
  "category": "FINANCIAL",
  "type": "COST_PROGRESS_MISMATCH",
  "classification": "FRAUD_RISK_INDICATOR", // ANOMALY | FRAUD_RISK_INDICATOR | INEFFICIENCY
  "severity": "HIGH",
  "confidence": 0.92,
  "title": "High expenditure with low physical progress",
  "description": "...",
  "expectedValue": 20, "actualValue": 90, "deviation": 70,
  "ruleId": "FINANCIAL_001",
  "source": "RULE_ENGINE", // RULE_ENGINE | ML_ENGINE | CV_ENGINE
  "evidenceIds": [],
  "parametersUsed": { "expenditurePercent": 90, "physicalProgress": 20 },
  "recommendedAction": "...",
  "status": "OPEN"
}
```
