# Hackathon Demo Flow

This mirrors section 39 of the build brief almost exactly, using data produced by
`npm run seed --workspace=server` — nothing shown below is faked for the demo, it's what the
detection pipeline actually computed against the seeded project.

## 1. Login as officer

`officer@mplad.local` / `Demo@123`.

## 2. Dashboard

The Officer Dashboard shows real KPI tiles (Total/Critical/High/Medium/Low/Open Investigations),
a "Projects Requiring Immediate Attention" table sorted by risk score, and three charts (Risk
Distribution, Project Status, Expenditure % vs Progress %) all computed from MongoDB via
`GET /projects/summary` and `GET /projects`.

## 3. Open the flagship project

Look for **"Rural Road & Bridge Connectivity Project"** (project code printed by the seed script,
e.g. `MPLAD-2026-0008`) — it combines every scenario from section 26 of the brief:

- Sanctioned ₹50,00,000 · Spent ₹45,00,000 (90%) · Actual progress 20%
- Required visits 8 · Actual visits 3
- Evidence similarity 96.8% (image reuse)
- Location mismatch (evidence GPS ~5.5km from the registered site)
- Quantity deviation (approved 1000, reported 1500)
- Missing expenditure justification + a duplicate invoice number

## 4. Click "Run Detection"

Triggers `POST /projects/:id/analyze`. The button re-runs the rule engine + ML engine, upserts
findings, and recomputes risk/priority — watch the risk badge update live.

## 5. Anomalies tab

Every finding above appears as its own row, each tagged with its classification (Anomaly / Fraud
Risk Indicator / Inefficiency — never "fraud"), severity, and status.

## 6. "Why was this flagged?"

The Overview tab's "Why This Project Is Flagged" panel lists the same findings with plain-language
descriptions. Expanding a finding row on the Anomalies tab shows Expected / Actual / Deviation /
Rule / Confidence / Recommended Action.

## 7. Evidence tab

Shows the reused-image pair with its similarity score; click "compare" for a side-by-side view.

## 8. Risk Analysis tab

Shows the overall score, the category-weighted breakdown chart (explicitly labeled as
configurable prototype weights, not official MPLAD weights), and score history.

## 9. Generate AI Investigation Summary

On the AI Report tab. If `ASTRA_*` env vars are unset (the default for this prototype), you'll
see "AI summary temporarily unavailable" — this is the required graceful-fallback behavior, not
a bug. With Astra configured, this produces an executive summary, key findings, and
recommended actions built strictly from the findings above (see
`services/astra/astraPromptBuilder.ts`).

## 10. Request Clarification

On the Anomalies tab, select one or more findings, write a message, and send. The finding(s)
move to `CLARIFICATION_REQUESTED`.

## 11. Switch to contractor

Log out, log in as `contractor@mplad.local` / `Demo@123`, open the same project, go to
Investigation tab, and respond to the clarification.

## 12. Switch back to officer

Review the response on the Investigation tab; Accept / Request More Info / Resolve.

## 13. Resolve & audit

Use the Investigation tab's "Resolve a Finding" form (or the clarification's "Resolve Finding(s)"
button), then open the Audit Trail tab — every action taken during this walkthrough
(`PROJECT_CREATED`, `SANCTION_CREATED`, `PROGRESS_SUBMITTED`, `ANOMALY_DETECTED`,
`RISK_UPDATED`, `CLARIFICATION_REQUESTED`, `CLARIFICATION_RESPONDED`, `INVESTIGATION_RESOLVED`,
etc.) is listed with the actor, role, and timestamp.
