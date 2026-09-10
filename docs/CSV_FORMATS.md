# CSV Import Formats

Two CSV imports drive the entire application: an officer imports a **project baseline**, and a
contractor imports **daily activity** against it. Every other feature (sanction, detection, risk,
priority, real-time updates) is derived from these two inputs plus whatever is submitted through
the UI forms and Evidence tab.

Both endpoints accept `multipart/form-data` with the file under field name `file`, parsed with
`csv-parse` (`server/src/services/csv/csvParser.ts`), validated row-by-row with Zod
(`server/src/services/import/projectImportService.ts` / `activityImportService.ts`), and are
**idempotent-safe** and **fail-loud**: invalid rows are reported individually, never silently
dropped, and a row that already exists is skipped with a warning rather than duplicated.

See [`samples/`](../samples) for ready-to-use example files and [`samples/README.md`](../samples/README.md)
for a walkthrough.

## 1. Officer Project Import — `POST /api/import/projects`

One row = one project. On success per row, the backend:
1. Creates the `Project`.
2. Finds the contractor by `contractor_email`, or creates a new CONTRACTOR account with a
   random temporary password (returned once in the import summary — there is no email delivery
   in this prototype, so relay it to the contractor out-of-band).
3. Auto-generates the `Sanction` (status `PENDING_APPROVAL`) from the row's financial/timeline/
   visit/evidence columns.
4. Creates up to 3 `Milestone` records from the `milestone_N_*` columns.

| Column | Required | Notes |
|---|---|---|
| `project_id` | no | Your own external reference; used to skip re-importing the same row twice |
| `project_name` | yes | |
| `project_type` | yes | Free text, e.g. "Road Construction" |
| `state` | yes | |
| `district` | yes | |
| `location` | yes | |
| `latitude`, `longitude` | yes | Numeric — used for GPS/location-mismatch detection |
| `beneficiary_description` | no | Appended to the project description |
| `contractor_name` | yes | |
| `contractor_email` | yes | Used to find-or-create the contractor's login |
| `contractor_phone` | no | |
| `sanctioned_amount` | yes | Must be positive |
| `released_amount` | no | Defaults to 90% of sanctioned if omitted |
| `start_date`, `end_date` | yes | ISO or `YYYY-MM-DD`; `end_date` must be after `start_date` |
| `expected_progress_percent` | no | Informational only — actual expected progress is always computed live from elapsed time |
| `approved_work_description` | yes | Becomes the sanction's `approvedWork` baseline |
| `planned_quantity`, `quantity_unit` | no | Used by the Quantity Deviation rule |
| `approved_materials` | no | |
| `required_site_visits_per_week` | no | Defaults to 1; multiplied by project duration to set the sanction's `requiredVisits` |
| `progress_reporting_frequency_days` | no | Defaults to 7 |
| `evidence_required` | no | `true`/`false`/`yes`/`no`/`1`/`0`; defaults to required |
| `milestone_1_date` / `milestone_1_expected_progress` (and `_2_`, `_3_`) | no | Any milestone missing a date is skipped with a warning |
| `expenditure_justification_required` | no | Same boolean parsing as `evidence_required` |
| `notes` | no | Appended to the project description |

## 2. Contractor Daily Activity Import — `POST /api/projects/:id/activities/import`

One row = one day's (or one batch's) reported activity. **Blocked until the contractor has
approved the project's sanction** (`POST /api/sanctions/:id/approve`). Each row can carry
progress, expenditure, a site visit, and/or a reference to evidence files, all optional — a row
contributes whichever of these it has data for.

| Column | Required | Notes |
|---|---|---|
| `activity_id` | **yes** | Idempotency key — re-uploading a CSV with the same `activity_id` values a second time re-reports each as "already imported — skipped" instead of duplicating |
| `project_id` | no | Sanity-checked against the target project; mismatches are warned, not rejected |
| `activity_date` | yes | |
| `progress_percent` | no | Updates `Project.actualProgress` if higher than the current value |
| `work_completed_description` | no | |
| `quantity_completed`, `quantity_unit` | no | Feeds Quantity Deviation |
| `expenditure_amount` | no | Adds to `Project.spentAmount` |
| `expenditure_category`, `invoice_number`, `vendor_name`, `expenditure_justification` | no | Feed the Expenditure Justification and Duplicate Invoice rules |
| `site_visit_date`, `site_visit_latitude`, `site_visit_longitude` | no (all three, or none) | Feeds Site Visit Compliance and Location Mismatch |
| `evidence_file_names` | no | `;` or `\|`-separated list — **referenced only**. A CSV cannot carry image bytes; each referenced filename produces a warning telling the contractor to upload it via the Evidence tab, where real hashing/similarity/GPS/timestamp analysis happens |
| `remarks` | no | |

After every successful import (at least one valid row), the backend automatically:
1. Runs the rule engine + ML engine (`runDetectionPipeline`).
2. Recalculates risk and priority.
3. Emits `activity:imported`, `findings:created`, `risk:updated`, `priority:updated`,
   `project:updated`, and `dashboard:updated` over Socket.IO to the officer — no manual refresh
   needed. See [`docs/REALTIME.md`](REALTIME.md).

## Validation philosophy

- A malformed row never silently vanishes — it's reported in `invalidRows` with the row number,
  offending field, and a human-readable message.
- A row that would create a duplicate (same `activity_id`, or same `project_id` external
  reference) is reported in `warnings` and skipped, never re-applied.
- Numeric thresholds used by the *detection* engine that consumes this data (progress gap,
  expenditure mismatch, visit shortfall, etc.) are separately documented in
  [`DETECTION_RULES_SOURCE.md`](DETECTION_RULES_SOURCE.md) — CSV validation and rule evaluation
  are deliberately independent layers.
