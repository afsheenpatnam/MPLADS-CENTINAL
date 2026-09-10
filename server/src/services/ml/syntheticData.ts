export interface ProjectFeatureRecord {
  sanctionedAmount: number;
  spentAmount: number;
  expenditurePercentage: number;
  elapsedPercentage: number;
  expectedProgress: number;
  actualProgress: number;
  progressGap: number;
  requiredVisits: number;
  actualVisits: number;
  visitCompliance: number;
  quantityPlanned: number;
  quantityReported: number;
  quantityDeviation: number;
  contractorProjectCount: number;
  contractorAnomalyRate: number;
  evidenceSimilarity: number;
  documentAnomalyCount: number;
}

export const FEATURE_ORDER: (keyof ProjectFeatureRecord)[] = [
  "expenditurePercentage",
  "elapsedPercentage",
  "progressGap",
  "visitCompliance",
  "quantityDeviation",
  "contractorAnomalyRate",
  "evidenceSimilarity",
  "documentAnomalyCount",
];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildRecord(base: Partial<ProjectFeatureRecord>): ProjectFeatureRecord {
  const sanctionedAmount = base.sanctionedAmount ?? rand(1000000, 8000000);
  const elapsedPercentage = clamp(base.elapsedPercentage ?? rand(5, 100), 0, 100);
  const expectedProgress = base.expectedProgress ?? elapsedPercentage;
  const actualProgress = clamp(base.actualProgress ?? expectedProgress + rand(-10, 10), 0, 100);
  const expenditurePercentage = clamp(base.expenditurePercentage ?? actualProgress + rand(-10, 10), 0, 120);
  const spentAmount = (sanctionedAmount * expenditurePercentage) / 100;
  const requiredVisits = base.requiredVisits ?? 8;
  const actualVisits = base.actualVisits ?? Math.round(requiredVisits * rand(0.7, 1));
  const quantityPlanned = base.quantityPlanned ?? 1000;
  const quantityReported = base.quantityReported ?? quantityPlanned * rand(0.9, 1.1);

  return {
    sanctionedAmount,
    spentAmount,
    expenditurePercentage,
    elapsedPercentage,
    expectedProgress,
    actualProgress,
    progressGap: Math.abs(expectedProgress - actualProgress),
    requiredVisits,
    actualVisits,
    visitCompliance: (actualVisits / requiredVisits) * 100,
    quantityPlanned,
    quantityReported,
    quantityDeviation: (Math.abs(quantityReported - quantityPlanned) / quantityPlanned) * 100,
    contractorProjectCount: base.contractorProjectCount ?? Math.round(rand(1, 12)),
    contractorAnomalyRate: base.contractorAnomalyRate ?? rand(0, 15),
    evidenceSimilarity: base.evidenceSimilarity ?? rand(0, 40),
    documentAnomalyCount: base.documentAnomalyCount ?? 0,
  };
}

/**
 * Generates a synthetic training dataset spanning normal and several known-abnormal
 * scenario families (delayed, high-spending, low-progress, visit violations,
 * quantity deviations, evidence anomalies) so the Isolation Forest sees a realistic
 * distribution rather than a single cluster of "normal" points.
 */
export function generateSyntheticDataset(size = 500): ProjectFeatureRecord[] {
  const records: ProjectFeatureRecord[] = [];

  const normalCount = Math.round(size * 0.7);
  const delayedCount = Math.round(size * 0.06);
  const highSpendCount = Math.round(size * 0.06);
  const lowProgressCount = Math.round(size * 0.06);
  const visitViolationCount = Math.round(size * 0.05);
  const quantityDeviationCount = Math.round(size * 0.04);
  const evidenceAnomalyCount = size - normalCount - delayedCount - highSpendCount - lowProgressCount - visitViolationCount - quantityDeviationCount;

  for (let i = 0; i < normalCount; i++) {
    records.push(buildRecord({}));
  }
  for (let i = 0; i < delayedCount; i++) {
    const elapsedPercentage = rand(70, 100);
    records.push(
      buildRecord({ elapsedPercentage, expectedProgress: elapsedPercentage, actualProgress: rand(10, 35) })
    );
  }
  for (let i = 0; i < highSpendCount; i++) {
    const actualProgress = rand(10, 30);
    records.push(buildRecord({ actualProgress, expenditurePercentage: rand(75, 98) }));
  }
  for (let i = 0; i < lowProgressCount; i++) {
    records.push(buildRecord({ elapsedPercentage: rand(60, 90), actualProgress: rand(5, 25) }));
  }
  for (let i = 0; i < visitViolationCount; i++) {
    const requiredVisits = 8;
    records.push(buildRecord({ requiredVisits, actualVisits: Math.round(rand(1, 3)) }));
  }
  for (let i = 0; i < quantityDeviationCount; i++) {
    records.push(buildRecord({ quantityPlanned: 1000, quantityReported: rand(1400, 1800) }));
  }
  for (let i = 0; i < evidenceAnomalyCount; i++) {
    records.push(
      buildRecord({ evidenceSimilarity: rand(85, 100), contractorAnomalyRate: rand(30, 60) })
    );
  }

  return records;
}
