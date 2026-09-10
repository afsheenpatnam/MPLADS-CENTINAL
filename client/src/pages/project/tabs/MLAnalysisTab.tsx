import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BrainCircuit, Database, Gauge, Sigma, Target } from "lucide-react";
import { detectionApi } from "../../../api/endpoints";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { Spinner } from "../../../components/ui/Spinner";
import type { Project } from "../../../types";

const FEATURE_LABELS: Record<string, string> = {
  expenditurePercentage: "Expenditure %",
  elapsedPercentage: "Elapsed %",
  expectedProgress: "Expected Progress",
  actualProgress: "Actual Progress",
  progressGap: "Progress Gap",
  visitCompliance: "Visit Compliance %",
  quantityDeviation: "Quantity Deviation %",
  contractorAnomalyRate: "Contractor Anomaly Rate %",
  evidenceSimilarity: "Evidence Similarity %",
  documentAnomalyCount: "Document Anomaly Count",
  sanctionedAmount: "Sanctioned Amount",
  spentAmount: "Spent Amount",
  requiredVisits: "Required Visits",
  actualVisits: "Actual Visits",
  quantityPlanned: "Quantity Planned",
  quantityReported: "Quantity Reported",
  contractorProjectCount: "Contractor Project Count",
};

const PIPELINE_STEPS = [
  { label: "Raw Data", icon: Database },
  { label: "Feature Engineering", icon: Sigma },
  { label: "ML Model", icon: BrainCircuit },
  { label: "Anomaly Score", icon: Target },
  { label: "Risk Engine", icon: Gauge },
];

export function MLAnalysisTab({ project }: { project: Project }) {
  const riskQuery = useQuery({ queryKey: ["risk", project._id], queryFn: () => detectionApi.risk(project._id) });

  if (riskQuery.isLoading) return <Spinner label="Loading ML analysis..." />;
  const latest = riskQuery.data?.latest;

  if (!latest) {
    return <p className="text-sm text-surface-400">No ML analysis yet. Run detection to generate one.</p>;
  }

  const features = Object.entries(latest.mlFeatures ?? {}).filter(([key]) => FEATURE_LABELS[key]);
  const dominantFeatures = new Set((latest.mlDominantSignals ?? []).map((s) => s.feature));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="How the ML Model Reached This Score" subtitle="Every step below runs on real imported data — nothing is randomly generated" />
        <CardBody>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1 rounded-xl bg-gradient-primary px-4 py-3 text-white shadow-sm">
                  <step.icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{step.label}</span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-surface-300" />}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Feature Vector" subtitle="Derived from actual project/activity data at analysis time" />
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-left text-xs uppercase text-surface-400">
                <tr>
                  <th className="px-4 py-2">Feature</th>
                  <th className="px-4 py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {features.map(([key, value]) => (
                  <tr key={key} className={`border-t border-surface-100 ${dominantFeatures.has(key) ? "bg-secondary-50" : ""}`}>
                    <td className="px-4 py-2 text-primary-800">{FEATURE_LABELS[key]}</td>
                    <td className="px-4 py-2 font-medium text-primary-900">{Number(value).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Anomaly Score" />
          <CardBody className="space-y-4">
            <div className="text-center">
              <p className="text-4xl font-extrabold text-primary-900">{latest.mlNormalizedScore}<span className="text-lg text-surface-400">/100</span></p>
              <p className="text-xs uppercase tracking-wide text-surface-400">Normalized Anomaly Score</p>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-100">
              <div
                className="h-full rounded-full bg-gradient-accent"
                style={{ width: `${Math.min(100, latest.mlNormalizedScore)}%` }}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-surface-400">Dominant Signals</p>
              <ul className="space-y-1">
                {(latest.mlDominantSignals ?? []).map((s) => (
                  <li key={s.feature} className="flex justify-between rounded-lg bg-secondary-50 px-3 py-1.5 text-sm">
                    <span className="text-secondary-800">{FEATURE_LABELS[s.feature] ?? s.feature}</span>
                    <span className="font-medium text-secondary-700">z = {s.zScore.toFixed(2)}</span>
                  </li>
                ))}
                {(!latest.mlDominantSignals || latest.mlDominantSignals.length === 0) && (
                  <p className="text-sm text-surface-400">No standout signals — this project looks statistically typical.</p>
                )}
              </ul>
            </div>
            <p className="text-xs text-surface-400">
              Model: {latest.modelVersion}. Prototype model trained/scored using available imported and/or synthetic
              reference data. This score is an anomaly indicator, not a fraud determination.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
