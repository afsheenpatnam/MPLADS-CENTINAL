# Architecture

## Monorepo layout

```
mplad-sentinel/ (repo root)
├── client/    React + Vite + TypeScript + Tailwind SPA
├── server/    Express + TypeScript + Mongoose + Socket.IO API
├── docs/      This documentation
├── samples/   Demonstration CSV inputs (never read by the running app itself)
├── uploads/   Evidence/document file storage (local disk, gitignored)
└── .github/   CI workflow
```

Managed as npm workspaces from the root `package.json` — no Lerna/Turborepo needed for a
project this size.

## Backend layering

```
routes/          → thin Express Router definitions, wires middleware + controllers
controllers/     → HTTP layer: validate (zod), call services, shape responses
middleware/      → auth (JWT), role authorization, project-access scoping, requireApprovedSanction, upload (multer), error handling
realtime/        → socketServer.ts — Socket.IO init + per-user private rooms (see docs/REALTIME.md)
services/
  detection/     → ruleEngine.ts (pure functions), detectionPipeline.ts (orchestration + Socket.IO emission)
  rules/         → ruleLoader.ts reads config/rules.json, supports runtime threshold overrides
  ml/            → isolationForest.ts (algorithm), syntheticData.ts (training set), mlEngine.ts (feature scoring)
  cv/            → evidenceProcessor.ts (hashing/similarity via sharp)
  risk/          → riskEngine.ts (scoring), riskWeights.ts (config + category mapping)
  priority/      → priorityEngine.ts
  astra/         → astraClient.ts (HTTP), astraPromptBuilder.ts, astraReportService.ts
  audit/         → auditService.ts (append-only log writer)
  csv/           → csvParser.ts (csv-parse wrapper), importTypes.ts (shared ImportSummary shape)
  import/        → projectImportService.ts (officer CSV → project+sanction+contractor+milestones),
                   activityImportService.ts (contractor CSV → progress/expenditure/site-visit + auto-detection),
                   contractorLookup.ts (find-or-create contractor by email)
models/          → 17 Mongoose schemas (incl. `Activity` — the raw imported-row audit trail), one file each
config/          → env.ts (env var loading/validation), db.ts (connection), rules.json (detection rule config)
seed/            → seed.ts — demo users + 30 projects incl. 8 named scenarios
```

**Why services are separated from controllers**: controllers only translate HTTP ⇄ domain calls.
Every engine (rule/ML/CV/risk/priority/astra) is a plain TypeScript module with no Express
dependency, so each is unit-testable in isolation (see `*.test.ts` next to each service) and
could be extracted into a worker/queue later without touching the HTTP layer.

## Frontend layering

```
api/         axios client (client.ts) + one function per backend endpoint (endpoints.ts)
types/       TypeScript interfaces mirroring the backend's Mongoose documents
hooks/       useAuth.tsx (JWT/session context), useSocket.tsx (Socket.IO connection, live
             notifications, query-cache invalidation — see docs/REALTIME.md)
components/  ui/ (Button, Card, Input, Badge, Tabs, StatCard, Spinner — hand-rolled, Tailwind-based,
             shadcn-equivalent) and ProtectedRoute.tsx
layouts/     AppLayout.tsx — sidebar shell with the "Live" badge + notification bell
pages/
  auth/          Login, Register
  officer/       Dashboard, ProjectCreate (manual), ProjectImport (CSV, drag-drop + validation summary)
  contractor/    Dashboard (assigned project cards + pending sanction approvals)
  project/       ProjectInvestigationPage.tsx (shared officer+contractor shell) + tabs/*.tsx —
                 Overview, Data Import, Sanction, Financials, Progress, SiteVisits, Evidence,
                 Investigation (all roles), plus Anomalies & Fraud Risk, ML Analysis, Risk &
                 Priority, AI Report, Audit Trail (officer-only, both hidden from nav and gated
                 by role in the render switch)
```

Data fetching goes through TanStack Query exclusively — no component holds fetched state in
`useState`/`useEffect`. Every number displayed comes from a live API call; nothing is hardcoded.

## Data flow: from submission to dashboard number

1. Contractor calls `POST /projects/:id/progress` (or expenditure/site-visit/evidence/document).
   The controller updates the `Project` document's running totals (`actualProgress`,
   `spentAmount`) and writes an audit log entry.
2. Officer calls `POST /projects/:id/analyze`. `detectionPipeline.ts` reads every collection for
   that project, runs the rule engine + ML engine, upserts `Finding` documents, computes a
   `RiskAssessment`, updates `Project.riskScore/riskLevel/priority`.
3. The officer dashboard's KPI tiles and "Projects Requiring Immediate Attention" table
   (`GET /projects/summary`, `GET /projects`) read directly from the `Project` collection — the
   numbers you see are exactly what's stored, not derived client-side from anything fake.
4. `GET /risk/high-priority` filters `Project.priority` server-side.

## Authentication & authorization

JWT bearer tokens (`Authorization: Bearer <token>`), signed with `JWT_SECRET`, carrying
`{ userId, role, email }`. `middleware/auth.ts` verifies the token; `middleware/projectAccess.ts`
loads the target `Project` and enforces:

- `OFFICER` — only projects where `project.officerId === user.userId`.
- `CONTRACTOR` — only projects where `project.contractorId === user.userId`.

There is no admin role — see "Officer/contractor data isolation" below for how the two roles'
very different views of the same `Project` document are enforced.

Passwords are hashed with bcrypt (10 rounds); `passwordHash` is `select: false` on the `User`
schema and stripped from every response via an explicit `toPublicUser` mapper.

## Officer/contractor data isolation

A contractor and an officer both call `GET /projects` and `GET /projects/:id` against the *same*
`Project` documents, but a contractor must never see risk score, risk level, priority, findings,
ML output, or AI reports (per the product brief's non-negotiable requirement). This is enforced
in two independent layers, deliberately redundant:

1. **Route-level**: `authorize("OFFICER")` blocks `/analyze`, `/findings`, `/risk`,
   `/ai-summary`, `/audit`, `/projects/summary`, and `/risk/high-priority` outright for a
   CONTRACTOR — these return `403`, not redacted data.
2. **Field-level**: `projectController.ts`'s `serializeProject()` strips `riskScore`,
   `riskLevel`, and `priority` from the `Project` document itself before it's sent to a
   CONTRACTOR, since `GET /projects` and `GET /projects/:id` are legitimately callable by both
   roles (just scoped to different project sets).

The frontend additionally never renders these fields for a contractor (see
`ProjectInvestigationPage.tsx`'s `OFFICER_ONLY_TABS` and the conditional rendering in
`OverviewTab.tsx`), but that's a UX nicety on top of the server-side enforcement above — a
contractor calling the API directly, bypassing the UI entirely, still cannot obtain this data.

## Idempotent detection

Re-running `POST /projects/:id/analyze` does not create duplicate findings. Each rule's draft
finding is keyed by `ruleId:type:<identity>` (identity = the evidence/milestone/expenditure/
condition id it's about, or `singleton` for project-wide rules like cost-progress mismatch).
Existing open findings matching that key are updated in place; only genuinely new findings are
inserted. This lets an officer click "Run Detection" repeatedly as new data comes in without the
Anomalies tab accumulating stale duplicates.

## Why an Isolation Forest was hand-rolled

No well-maintained, dependency-light Isolation Forest npm package could be assumed reliably
available, and the brief explicitly asks for a real algorithm, not a stats shortcut disguised as
ML. `services/ml/isolationForest.ts` implements the actual algorithm (random partitioning trees,
path-length-based anomaly scoring) in ~120 lines of TypeScript, trained on a synthetic dataset
generated at server-start (`syntheticData.ts`, 500 records spanning normal + 6 abnormal
scenario families). It is a genuine unsupervised anomaly detector with no knowledge of MPLAD
rules — it only sees numeric feature vectors, exactly as required.
