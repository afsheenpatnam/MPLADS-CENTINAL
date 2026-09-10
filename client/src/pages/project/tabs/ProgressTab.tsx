import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { progressApi } from "../../../api/endpoints";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { Input, Label, Textarea } from "../../../components/ui/Input";
import { useAuth } from "../../../hooks/useAuth";
import type { Project } from "../../../types";

export function ProgressTab({ project }: { project: Project }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isContractor = user?.role === "CONTRACTOR";

  const progressQuery = useQuery({ queryKey: ["progress", project._id], queryFn: () => progressApi.list(project._id) });

  const [form, setForm] = useState({ physicalProgress: "", reportedWork: "", reportedQuantity: "", remarks: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await progressApi.submit(project._id, {
        date: new Date().toISOString() as any,
        physicalProgress: Number(form.physicalProgress),
        reportedWork: form.reportedWork,
        reportedQuantity: form.reportedQuantity ? Number(form.reportedQuantity) : undefined,
        remarks: form.remarks || undefined,
      });
      setForm({ physicalProgress: "", reportedWork: "", reportedQuantity: "", remarks: "" });
      queryClient.invalidateQueries({ queryKey: ["progress", project._id] });
      queryClient.invalidateQueries({ queryKey: ["project", project._id] });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to submit progress");
    } finally {
      setSubmitting(false);
    }
  };

  const chartData = (progressQuery.data ?? [])
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((p) => ({ date: new Date(p.date).toLocaleDateString(), progress: p.physicalProgress }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Progress Over Time" />
        <CardBody style={{ height: 240 }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="progress" stroke="#8B5E3C" strokeWidth={2} name="Physical Progress %" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-primary-400">No progress submissions yet.</p>
          )}
        </CardBody>
      </Card>

      {isContractor && (
        <Card>
          <CardHeader title="Submit Progress" />
          <CardBody>
            <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Physical Progress (%)</Label>
                <Input type="number" min={0} max={100} value={form.physicalProgress} onChange={(e) => setForm({ ...form, physicalProgress: e.target.value })} required />
              </div>
              <div>
                <Label>Reported Quantity (optional)</Label>
                <Input type="number" value={form.reportedQuantity} onChange={(e) => setForm({ ...form, reportedQuantity: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Reported Work</Label>
                <Textarea value={form.reportedWork} onChange={(e) => setForm({ ...form, reportedWork: e.target.value })} rows={2} required />
              </div>
              <div className="sm:col-span-2">
                <Label>Remarks (optional)</Label>
                <Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
              </div>
              {error && <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit Progress"}</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Progress History" />
        <CardBody className="space-y-2">
          {(progressQuery.data ?? []).map((p) => (
            <div key={p._id} className="rounded-lg border border-primary-100 px-3 py-2 text-sm">
              <p className="font-medium">{p.physicalProgress}% — {new Date(p.date).toLocaleDateString()}</p>
              <p className="text-primary-500">{p.reportedWork}</p>
            </div>
          ))}
          {(progressQuery.data ?? []).length === 0 && <p className="text-sm text-primary-400">No progress submitted yet.</p>}
        </CardBody>
      </Card>
    </div>
  );
}
