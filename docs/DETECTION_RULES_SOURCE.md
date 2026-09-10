# Detection Rules — Source Traceability

**Source of truth:** [`ANAMOLIES.txt`](../ANAMOLIES.txt) (root of this workspace).

This document is the bridge between the raw conditions file and the machine-readable
rule definitions in [`server/src/config/rules.json`](../server/src/config/rules.json).
Every rule the detection engine evaluates must trace back to one of the categories
below. **No rule exists in the engine that is not derived from this file.**

> `ANAMOLIES.txt` describes *categories* of anomaly/fraud/inefficiency detection
> (e.g. "Time Anomaly Detection", "Cost Anomaly Detection") in prose. It does **not**
> specify numeric thresholds, tolerances, or exact formulas. Every numeric threshold
> used by the engine (e.g. "progress gap > 25 points", "GPS tolerance = 200m") is
> therefore a **configurable demonstration threshold** — a reasonable prototype value
> chosen for this hackathon build, stored in `rules.json`, editable by an admin, and
> explicitly *not* presented as an official MPLAD/government-mandated figure anywhere
> in the UI or docs.

## Traceability Matrix

| # | ANAMOLIES.txt section | Engine category | Rule IDs | Notes |
|---|---|---|---|---|
| 1 | ⏱️ Time Anomaly Detection — "comparing actual progress against planned milestones" | `TIME_PROGRESS` | `PROGRESS_001`, `PROGRESS_002` | Elapsed-time vs actual-progress gap; milestone due-date slippage |
| 2 | 💰 Cost Anomaly Detection — "abnormal spending, budget overruns, inflated invoices, potential fund misuse" | `FINANCIAL` | `FINANCIAL_001`–`FINANCIAL_004` | Cost/progress mismatch, budget overrun pace, missing justification, duplicate/inflated invoices |
| 3 | 🏗️ Work Anomaly Detection — "GPS logs, image evidence, activity updates to detect fake or incomplete work" | `WORK_EVIDENCE` | `WORK_001`–`WORK_004` | Evidence corroboration, GPS location mismatch, timestamp plausibility, image reuse (perceptual hash) |
| 4 | 📋 Sanction Report Verification (FRAUD) — "activities, expenditures, and progress align with the approved sanction report" | `SANCTION_COMPLIANCE` | `SANCTION_001` | Deviation from sanctioned amount / timeline / approved work scope |
| 5 | 🏗️ Plan vs Construction Inefficiency — "deviations between the approved project plan and actual construction" | `PLAN_ACTUAL` | `PLAN_001` | Reported/observed work vs approved work scope |
| 6 | 🔍 Quality Check — "quality of construction materials and workmanship" | `QUALITY` | `QUALITY_001` | No automated material-science test is possible in an MVP; implemented as an evidence-validation + officer-flag signal, explicitly not a lab-grade quality assessment |
| 7 | 📦 Quantity Check — "reported quantity ... matches actual on-site usage" | `QUANTITY` | `QUANTITY_001` | Approved vs reported quantity deviation |
| 8 | 📑 Condition Compliance Monitoring (FRAUD) — "adhere to ... approval conditions, quality standards, contractual obligations" | `CONDITION_COMPLIANCE` | `CONDITION_001` | Any `Condition` document marked unmet |
| 9 | 💰 Expenditure Anomaly (FRAUD) — "significant difference ... between project expenditure and actual work completed" | `FINANCIAL` (fraud-weighted) | `FINANCIAL_001` (shared) | Same signal as cost-progress mismatch, escalated when combined with other indicators |
| 10 | 📍 Scheduled Site Attendance Monitoring (FRAUD) — "report at project site on pre-assigned dates ... GPS-based check-ins and geofencing" | `VISIT` | `VISIT_001` | Required vs actual site visits, net of officer-approved exceptions |

Two rules are **derived/aggregate** rules that the instructions for this build
explicitly ask for (contractor pattern analysis, cross-project document consistency)
and are reasonable extensions of the categories above rather than new categories:

| Engine category | Rule IDs | Derived from |
|---|---|---|
| `CONTRACTOR_PATTERN` | `CONTRACTOR_001` | Aggregates rows 2, 3, 9, 10 across a contractor's projects |
| `DOCUMENT` | `DOCUMENT_001` | Row 2 ("inflated invoices") applied to the Documents/Expenditure collections |

## How rules are used

* `rules.json` is loaded at server startup by `services/rules/ruleLoader.ts`.
* Each rule has `enabled` and `configurable` flags — an admin can disable or retune
  thresholds without a code change or redeploy.
* `services/detection/ruleEngine.ts` evaluates each enabled rule generically using
  its `parameters`, `operator`, and `threshold` — there is no per-project or
  per-rule hardcoded logic.
* Findings produced by the rule engine always carry `"source": "RULE_ENGINE"` and the
  `ruleId` that produced them, so every flag in the UI can be traced back to this
  document.

## Anomaly vs Fraud vs Inefficiency

Per the build's non-negotiable requirement, the engine never labels a finding
"fraud" outright. Categories map to a `type` classification, not an accusation:

* **Anomaly** — an unusual/inconsistent pattern (`TIME_PROGRESS`, `WORK_EVIDENCE`, `QUANTITY`, `QUALITY`).
* **Fraud risk indicator** — requires investigation (`SANCTION_COMPLIANCE`, `CONDITION_COMPLIANCE`, `FINANCIAL`, `VISIT`, `CONTRACTOR_PATTERN`, `DOCUMENT`). Findings in these categories are always worded as "potential ... risk indicator, requires verification" — never as a fraud conclusion.
* **Inefficiency** — resources/time not producing expected output (`PLAN_ACTUAL` and the derived `INEFFICIENCY_001` signal computed from `TIME_PROGRESS` + `FINANCIAL`).

The officer always makes the final determination; the system only surfaces
evidence-backed findings with confidence scores.
