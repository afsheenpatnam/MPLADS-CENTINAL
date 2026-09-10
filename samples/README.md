# Sample CSV Files

These are **demonstration/test inputs only** — the production app never reads from this folder.
They exist so the CSV import pipeline can be exercised end-to-end without hand-typing data.

The detection engine does not know these files exist and contains no logic keyed to their
contents — it reacts identically to any project/activity data that produces the same numbers,
regardless of source. See `docs/CSV_FORMATS.md` for the full column reference.

| File | Uploaded by | Purpose |
|---|---|---|
| `officer_projects_clean.csv` | Officer, at `POST /api/import/projects` | One well-behaved project baseline: normal budget pace, realistic milestones. |
| `officer_projects_anomaly_demo.csv` | Officer | The flagship demo project baseline — an 12-month project that started ~11 months before "today", so importing normal-looking activity later still produces a large elapsed-time-vs-progress gap. |
| `contractor_daily_activity_normal.csv` | Contractor, at `POST /api/projects/:id/activities/import` (after approving the sanction generated from `officer_projects_clean.csv`) | Steady progress/expenditure/visits proportional to elapsed time — no findings should fire. |
| `contractor_daily_activity_anomaly_demo.csv` | Contractor (against the project created from `officer_projects_anomaly_demo.csv`) | Deliberately shaped to trigger, from real computed deviations (not hardcoded labels): cost-progress mismatch (90% spent / 20% progress), a missing-justification finding (row 3, no justification on a ₹15,00,000 entry), a duplicate invoice number (`INV-DUP-001` on rows 1 and 2), a quantity deviation (1500 reported vs 1000 planned), and a site-visit shortfall (3 visits recorded against ~106 required for a 2/week project over ~11 months). |
| `officer_projects_visit_violation_demo.csv` | Officer | A community hall project requiring 2 site visits/week. |
| `contractor_daily_activity_visit_violation_demo.csv` | Contractor (against the visit-violation project) | Progress and expenditure track elapsed time normally (no cost/progress mismatch), but only 2 site visits are recorded against ~104 required — isolates `VISIT_001` as the clearest signal. Lands around MEDIUM/LOW overall risk with one HIGH-severity finding, which is itself a useful demo of the risk engine not over-reacting to a single isolated issue. |
| `officer_projects_quantity_deviation_demo.csv` | Officer | A storm-water drain project with a 1000-running-metre approved quantity. |
| `contractor_daily_activity_quantity_deviation_demo.csv` | Contractor (against the quantity-deviation project) | Reports 1650m completed against the 1000m plan (65% deviation) — isolates `QUANTITY_001`. Also under-visits (2 of ~44 required), so `VISIT_001` fires too — a realistic multi-signal case. |

## How to use them

1. Log in as `officer@mplad.local` (see root `README.md` for the password).
2. Go to **Import Projects**, upload `officer_projects_anomaly_demo.csv`. This creates the
   project, a `PENDING_APPROVAL` sanction, and (if the email isn't already registered) a new
   contractor account — the import summary will show a temporary password for it.
3. Log in as that contractor (or `contractor@mplad.local` if you reused an existing email),
   open the project, and approve the sanction.
4. Upload `contractor_daily_activity_anomaly_demo.csv` on the **Daily Activity Import** screen.
   This triggers the full pipeline (validation → idempotency check → MongoDB write → rule engine
   → ML scoring → risk/priority recalculation) and pushes a real-time update to the officer.
5. Switch back to the officer — the dashboard updates live (or on next fetch) showing the new
   risk level, priority, and findings.
6. Re-uploading the same activity CSV a second time should report every row as
   "already imported — skipped" (idempotency), not create duplicates.

## Evidence images

CSV rows can only *reference* evidence filenames (`evidence_file_names`) — a CSV cannot carry
image bytes. The import will show a warning listing referenced filenames; the actual image
reuse/similarity/GPS/timestamp detection only runs on files you upload yourself through the
Evidence tab (any two similar photos you upload there will demonstrate the reuse detection).
