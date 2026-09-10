import { IsolationForest } from "./isolationForest";
import { FEATURE_ORDER, generateSyntheticDataset, ProjectFeatureRecord } from "./syntheticData";

const MODEL_VERSION = "isolation-forest-1.0.0";

let forest: IsolationForest | null = null;
let featureStats: { mean: number; std: number }[] = [];

function toVector(record: ProjectFeatureRecord): number[] {
  return FEATURE_ORDER.map((key) => record[key]);
}

function computeStats(vectors: number[][]): { mean: number; std: number }[] {
  const numFeatures = vectors[0].length;
  const stats: { mean: number; std: number }[] = [];
  for (let f = 0; f < numFeatures; f++) {
    const values = vectors.map((v) => v[f]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    stats.push({ mean, std: Math.sqrt(variance) || 1 });
  }
  return stats;
}

/** Trains the Isolation Forest once (lazily) on a synthetic reference dataset. */
function ensureModel(): void {
  if (forest) return;
  const dataset = generateSyntheticDataset(500);
  const vectors = dataset.map(toVector);
  featureStats = computeStats(vectors);

  forest = new IsolationForest({ numTrees: 120, sampleSize: 256 });
  forest.fit(vectors);
}

export interface MlAnalysisResult {
  anomalyScore: number; // raw isolation forest score, 0-1
  normalizedScore: number; // 0-100, higher = more anomalous
  modelVersion: string;
  featuresUsed: string[];
  dominantSignals: { feature: string; value: number; zScore: number }[];
}

export function analyzeProjectFeatures(record: ProjectFeatureRecord): MlAnalysisResult {
  ensureModel();
  const vector = toVector(record);
  const rawScore = forest!.score(vector);
  const normalizedScore = Math.round(clamp01((rawScore - 0.4) / 0.25) * 100);

  const zScores = vector.map((value, i) => ({
    feature: FEATURE_ORDER[i],
    value,
    zScore: (value - featureStats[i].mean) / featureStats[i].std,
  }));

  const dominantSignals = [...zScores]
    .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
    .slice(0, 3)
    .map((s) => ({ feature: s.feature, value: Number(s.value.toFixed(2)), zScore: Number(s.zScore.toFixed(2)) }));

  return {
    anomalyScore: Number(rawScore.toFixed(4)),
    normalizedScore,
    modelVersion: MODEL_VERSION,
    featuresUsed: [...FEATURE_ORDER],
    dominantSignals,
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function retrainModel(): void {
  forest = null;
  ensureModel();
}
