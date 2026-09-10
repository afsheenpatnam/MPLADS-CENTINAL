# Machine Learning Engine

`server/src/services/ml/` implements a genuine, from-scratch **Isolation Forest** — not a random
number generator dressed up as "AI". This document explains what it does, what it doesn't, and
where to see it in the UI.

## Algorithm

`isolationForest.ts` implements the real Liu/Ting/Zhou (2008) algorithm:

1. Build an ensemble of random binary trees (default 120), each trained on a random sub-sample
   (default 256 rows) of a reference dataset.
2. Each tree splits recursively on a randomly chosen feature at a randomly chosen threshold
   within that feature's observed range in the current subset.
3. A point's anomaly score is derived from its **average path length** to a leaf across every
   tree — anomalies isolate quickly (short paths), normal points take longer to isolate.

The reference dataset (`syntheticData.ts`) is 500 generated records spanning a normal cluster
plus six labeled abnormal families (delayed, high-spend, low-progress, visit-violation,
quantity-deviation, evidence-anomaly) so the forest sees a realistic distribution, not just one
blob. This is honestly labeled everywhere it's surfaced as **"prototype model trained/scored
using available imported and/or synthetic reference data"** — never claimed as a
government-trained model on real historical MPLAD data, because no such dataset exists here.

## Feature vector

Computed fresh at every detection run from the project's actual current state (not from the
synthetic dataset) in `detectionPipeline.ts`:

| Feature | Source |
|---|---|
| `expenditurePercentage` | `spentAmount / sanctionedAmount` |
| `elapsedPercentage` | days elapsed / total sanctioned duration |
| `progressGap` | `\|elapsedPercentage − actualProgress\|` |
| `visitCompliance` | `actualVisits / requiredVisits` |
| `quantityDeviation` | `\|reportedQuantity − plannedQuantity\| / plannedQuantity` |
| `contractorAnomalyRate` | % of this contractor's other projects at HIGH/CRITICAL risk |
| `evidenceSimilarity` | highest perceptual-hash similarity score among this project's evidence |
| `documentAnomalyCount` | reserved for future document-level anomaly counting |

## Output

`analyzeProjectFeatures()` returns:

- `anomalyScore` — raw Isolation Forest score in `[0, 1]`.
- `normalizedScore` — rescaled to `0–100` for display.
- `dominantSignals` — the top 3 features by z-score against the reference dataset's
  mean/variance, i.e. "what's driving this score."
- `modelVersion` — currently `isolation-forest-1.0.0`.

A `normalizedScore ≥ 65` adds a `STATISTICAL_ANOMALY` finding (category `ML`, source
`ML_ENGINE`), worded as an anomaly indicator ("ML detects unusual patterns — it does not
determine fraud"), never as a fraud conclusion.

## Where to see it

The Officer's **ML Analysis** tab (project investigation page, officer-only) renders the full
pipeline — Raw Data → Feature Engineering → ML Model → Anomaly Score → Risk Engine — followed by
the actual feature-vector table and dominant-signal breakdown for that project's most recent
detection run. Nothing there is hardcoded; it's read straight from the `RiskAssessment` document
that `detectionPipeline.ts` persists (`mlFeatures`, `mlNormalizedScore`, `mlDominantSignals`).

## What ML does *not* do

- It does not determine fraud — see `docs/DETECTION_RULES_SOURCE.md` for the
  anomaly/fraud-risk-indicator/inefficiency distinction enforced everywhere in this app.
- It never sees or influences officer-only vs. contractor-visible authorization — that's a
  separate, purely rule-based access-control layer.
- It is not re-trained on live data; the reference dataset is generated once per server process
  (`ensureModel()` in `mlEngine.ts` is lazy and memoized). Retraining on a real historical MPLAD
  dataset, if one ever becomes available, only requires replacing `generateSyntheticDataset()`'s
  output with real records — the rest of the pipeline is unchanged.
