import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { detectionApi } from "../../../api/endpoints";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { RiskBadge } from "../../../components/ui/Badge";
import { Spinner } from "../../../components/ui/Spinner";
import type { Project } from "../../../types";

export function RiskTab({ project }: { project: Project }) {
  const riskQuery = useQuery({ queryKey: ["risk", project._id], queryFn: () => detectionApi.risk(project._id) });

  if (riskQuery.isLoading) return <Spinner label="Loading risk analysis..." />;
  const latest = riskQuery.data?.latest;

  if (!latest) {
    return <p className="text-sm text-primary-400">No risk assessment yet. Run detection to generate one.</p>;
  }

  const factorData = latest.riskFactors.map((f) => ({ name: f.category, contribution: f.contribution, weight: f.weight, findings: f.findingCount }));
  const historyData = (riskQuery.data?.history ?? [])
    .slice()
    .reverse()
    .map((h) => ({ date: new Date(h.createdAt).toLocaleDateString(), score: h.score }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs text-primary-400">Overall Risk Score</p>
          <p className="text-3xl font-bold text-primary-900">{latest.score}/100</p>
        </div>
        <RiskBadge level={latest.level} className="text-sm" />
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Field label="Rule Score" value={latest.ruleScore} />
          <Field label="ML Score" value={latest.mlScore} />
          <Field label="Financial" value={latest.financialScore} />
          <Field label="Evidence" value={latest.evidenceScore} />
        </div>
      </div>

      <Card>
        <CardHeader title="Risk Factor Breakdown" subtitle="Configurable prototype weights × worst severity present in each category — not official MPLAD weights" />
        <CardBody style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={factorData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number, name: string) => [value, name === "contribution" ? "Contribution" : name]} />
              <Bar dataKey="contribution" fill="#2563EB" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      {historyData.length > 1 && (
        <Card>
          <CardHeader title="Risk Score History" />
          <CardBody style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#DC2626" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-primary-400">{label}</p>
      <p className="font-semibold text-primary-800">{value.toFixed(1)}</p>
    </div>
  );
}
