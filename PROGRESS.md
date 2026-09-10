# MPLAD Sentinel — Build Progress

Legend: ⬜ not started · 🟨 in progress · ✅ done

## MPLAD Sentinel modification pass (rebrand + CSV/real-time pipeline + role simplification)

The phase table and log below (originally written as "MPLAD Insight") record the from-scratch
build of the detection/risk/priority/Astra core. A later, larger modification pass took that
working application and turned it into the final "MPLAD Sentinel" product: renamed and re-themed,
ADMIN role removed entirely, and — the biggest functional change — a CSV-driven, real-time
end-to-end pipeline replacing manual-only data entry as the primary workflow. See the final
chat report for the full 19-point summary; the short version:

- **Removed**: `ADMIN` role/routes/controllers/seed user/UI entirely (User model enum, all
  `authorize()` calls, `adminApi`, admin pages, admin nav links, admin option in Register).
- **Added — CSV import pipeline**: `POST /api/import/projects` (officer: creates project +
  auto-generated `PENDING_APPROVAL` sanction + contractor, find-or-create by email) and
  `POST /api/projects/:id/activities/import` (contractor: idempotent-by-`activity_id` daily
  activity → fans out into Progress/Expenditure/SiteVisit + auto-runs detection). New `Activity`
  model preserves the raw imported row. `docs/CSV_FORMATS.md` + `samples/` cover both.
- **Added — sanction approval workflow**: `Sanction.status` (`PENDING_APPROVAL`/`APPROVED`),
  `POST /api/sanctions/:id/approve`, and a new `requireApprovedSanction` middleware blocking all
  contractor submission endpoints (progress/expenditure/site-visits/evidence/activity-import)
  until the contractor approves.
- **Added — real-time**: Socket.IO (`server/src/realtime/socketServer.ts`, per-user private
  rooms, JWT-authenticated) emits `activity:imported`/`findings:created`/`risk:updated`/
  `priority:updated`/`project:updated`/`dashboard:updated`/`sanction:pending` events; client
  `useSocket.tsx` invalidates the relevant TanStack Query caches and drives a "Live" badge +
  notification bell in `AppLayout`. Verified live: a contractor's CSV upload updates a second,
  already-open officer browser session with no reload. See `docs/REALTIME.md`.
- **Added — officer/contractor data isolation hardening**: `projectController.ts`'s
  `serializeProject()` strips `riskScore`/`riskLevel`/`priority` from `Project` responses for
  CONTRACTOR (route-level `authorize("OFFICER")` already blocked findings/risk/ML/AI/audit/
  summary/high-priority outright); frontend `OverviewTab`/`ProjectInvestigationPage` stopped
  rendering those fields for contractors too (defense in depth, not the sole guard).
- **Added — ML Analysis tab**: officer-only UI showing the pipeline diagram, the real persisted
  feature vector, and dominant signals (`RiskAssessment.mlFeatures`/`mlNormalizedScore`/
  `mlDominantSignals`, newly persisted by `detectionPipeline.ts`). See `docs/ML.md`.
- **Re-themed**: brown/cream → blue/purple/cyan analytics palette (`tailwind.config.js`
  `primary`/`secondary`/`accent`/`risk` scales + gradient utilities), top-nav → sidebar layout,
  "MPLAD INSIGHT" → "MPLAD SENTINEL" branding everywhere (including two stale occurrences in
  `Login.tsx`/`Register.tsx` found and fixed during this pass).
- **Added**: `docs/CSV_FORMATS.md`, `docs/ML.md`, `docs/REALTIME.md`, `docs/DEPLOYMENT.md`,
  `CONTRIBUTING.md`, `.github/workflows/ci.yml`, `samples/*.csv` + `samples/README.md`.
- **Fixed during verification**: dashboard's "Projects Requiring Immediate Attention" table was
  filtering on `riskLevel` only, which misses the exact case the priority engine exists for (a
  MEDIUM-risk project elevated to CRITICAL priority by unresolved-finding count/age/exposure) —
  now filters on `priority OR riskLevel`.
- **Verified live** (Playwright against real running servers + a real local MongoDB, not mocked):
  officer CSV import → sanction auto-generated with a temp contractor password → contractor
  login → sanction review/approve → contractor daily-activity CSV import → automatic detection →
  real-time push to an already-open officer session (dashboard KPIs, attention table, and
  notification bell all updated with zero manual refresh) → officer Anomalies/ML Analysis tabs
  render real per-project data. Zero browser console errors on either session throughout.

---

## Original build phases (MPLAD Insight → MPLAD Sentinel core)

| Phase | Description | Status | Notes |
|---|---|---|---|
| 0 | Workspace inspection, conditions file | ✅ | Workspace was empty. `ANAMOLIES.txt` captured at root, traced in `docs/DETECTION_RULES_SOURCE.md`, encoded in `server/src/config/rules.json` (18 rules). |
| 1 | MERN architecture / scaffold | ✅ | npm-workspaces monorepo: `client/` (Vite+React+TS+Tailwind), `server/` (Express+TS+Mongoose) |
| 2 | MongoDB models | ✅ | 16 Mongoose schemas in `server/src/models` |
| 3 | Authentication | ✅ | JWT + bcrypt, 3 roles, role- and ownership-scoped project access |
| 4 | Officer workflow | ✅ | Project/Sanction/Condition/Milestone create + contractor assignment |
| 5 | Contractor workflow | ✅ | Progress/Expenditure/SiteVisit/Evidence/Document/Exception submission APIs + UI |
| 6 | Rule engine | ✅ | 18 rules in `rules.json`, generic evaluator in `services/detection/ruleEngine.ts`, idempotent upsert into `Finding` |
| 7 | ML engine | ✅ | From-scratch Isolation Forest, trained on a 500-record synthetic dataset spanning 6 abnormal scenario families |
| 8 | CV / evidence engine | ✅ | SHA-256 file hash + hand-rolled dHash perceptual hash + Hamming-distance similarity via `sharp` |
| 9 | Risk engine | ✅ | Weighted (9 categories, brief's example weights), max-severity-per-category, 0-100 normalized |
| 10 | Priority engine | ✅ | Risk + unresolved count + severity mix + investigation age + financial exposure |
| 11 | Astra LLM | ✅ | Client + prompt builder + report service; fails soft to "AI summary temporarily unavailable" |
| 12 | Officer UI | ✅ | Dashboard (KPIs, filters, 3 real charts, attention table), Project Create, full Investigation page |
| 13 | Contractor UI | ✅ | Assigned-project cards + all submission forms inside the shared Investigation page |
| 14 | Investigation workflow | ✅ | Clarification (request/respond/review) + Exception (request/review) + Resolve, all wired UI↔API |
| 15 | Audit log | ✅ | `auditService` called from every mutating controller; Audit Trail tab renders it |
| 16 | Demo data | ✅ | `npm run seed` — 3 officers, 8 contractors, 30 projects incl. the 8 named scenarios, each run through the real detection pipeline at seed time |
| 17 | Testing | ✅ | 33 Jest tests: isolation forest, CV hashing, rule engine (progress/financial/visit/location/condition rules), risk engine, priority engine, auth API, full officer→contractor→detection→clarification→resolution→audit e2e flow, cross-role access isolation |
| 18 | Final integration | ✅ | See verification log below |

## Final verification log

Run from a clean install (`npm install` at root):

- `npm run typecheck` (both workspaces) — **clean, 0 errors**
- `npm run lint` (both workspaces) — **clean, 0 warnings**
- `npm run test --workspace=server` — **33/33 passing**
- `npm run build` (both workspaces) — **both succeed**
- `npm run seed --workspace=server` against a live local MongoDB — **30 projects created**; the
  seeded flagship "Rural Road & Bridge Connectivity Project" scenario independently computed to
  **riskScore 64 (HIGH)**, **priority CRITICAL**, with 12 real findings spanning every category
  (financial, time/progress, visit, location, evidence reuse at exactly 96.8% similarity,
  quantity deviation, quality, plan-vs-actual, and a statistical ML anomaly at 100/100).
- Live browser verification (Playwright against the running dev servers): login → dashboard with
  real KPIs/charts → project investigation → Run Detection → Anomalies tab (11 findings, each
  correctly classified Anomaly/Fraud Risk Indicator/Inefficiency) → Risk Analysis tab (weighted
  breakdown chart + score history) → AI Report tab (correct "temporarily unavailable" fallback,
  since Astra isn't configured in this environment) → Evidence tab (reused-image pair with
  96.8% similarity and a working compare view). No console errors other than expected 404s for
  seeded evidence's synthetic (non-existent) image files — see note below.
- Confirmed no secrets are committed: `.env` is git-ignored, `.env.example` has empty values,
  `server/src/config/rules.json` and all seed data are static/synthetic.

## Known, deliberate limitations (documented, not oversights)

- **Seeded evidence has no real image files.** `Evidence` records created by `seed.ts` carry
  realistic hashes/GPS/similarity data but reference filenames that were never actually written
  to `uploads/`, so their thumbnails 404 in the UI. Evidence uploaded through the real UI
  (Contractor → Evidence tab) saves and serves genuine files correctly — this was verified live.
- **Astra's exact request/response contract is assumed OpenAI-compatible** (`{model,messages} -> {choices:[{message:{content}}]}`)
  since no concrete Astra API spec was provided. `astraClient.ts` is the single place to adjust
  if your deployment differs.
- **Quality Check (QUALITY_001)** is explicitly *not* a material-science test — it aggregates
  CV-flagged evidence and officer/site-visit remarks, documented as such in
  `docs/DETECTION_RULES_SOURCE.md`.
- Frontend production bundle is a single ~935KB chunk (no route-based code-splitting) — fine for
  a hackathon prototype, called out by Vite's build warning, not addressed to keep scope bounded.

## Engineering decisions log

- **Monorepo layout**: npm workspaces (`client/`, `server/`) with a root `package.json` orchestrating scripts, instead of a separate tool like Turborepo — keeps the prototype simple to install/run.
- **ML**: implemented a real (from-scratch) Isolation Forest in TypeScript (`server/src/services/ml/isolationForest.ts`) rather than pulling in a Python service, per the instruction to prefer Node/TS for the MVP.
- **CV**: perceptual hashing implemented via `sharp` (grayscale + resize + difference-hash) rather than an external phash binary, so the whole app stays pure Node.
- **Thresholds**: `ANAMOLIES.txt` names categories but gives no numbers. All numeric thresholds in `rules.json` are labeled `"configurable demonstration threshold"` and are admin-editable at runtime (not hardcoded into route/controller logic).
- **Astra LLM**: fails soft — any network/API error results in `{ status: "unavailable" }` and the UI shows "AI summary temporarily unavailable." Deterministic detection never depends on Astra being reachable.
- **Risk weight folding**: the brief's example risk-weight table has exactly 9 categories (summing to 130, not 100 — intentional, since the score is normalized against the sum of weights actually in play, not against 100 directly). Rule categories without their own bucket (`PLAN_ACTUAL`, `QUALITY`, `SANCTION_COMPLIANCE`, `CONDITION_COMPLIANCE`) are folded into the closest existing bucket (see `resolveRiskCategory` in `riskWeights.ts`) rather than adding more categories to the denominator, which would have diluted every score and made HIGH/CRITICAL unreachably rare.
- **Idempotent detection**: re-running analysis upserts findings by a stable `ruleId:type:identity` key instead of duplicating them, so an officer can re-analyze after new contractor submissions without the Anomalies tab accumulating stale duplicates.
- **UI theme**: built to the brief's final, most specific instruction (brown/cream, colorful, attractive) rather than the earlier generic "dark navy government" note — both appear in the brief and the later one is more specific and explicit about color.
- **Duplicate project discovered mid-build**: a separate, apparently complete prior build of this same app was found at `C:\Users\SIRI\Downloads\MPLAD-Sentinel\mplad-sentinel` (different working directory, not touched). Per explicit user direction, this workspace (`OneDrive\Desktop\MPLAD Sentinel`) was built independently and is the canonical deliverable for this session.
