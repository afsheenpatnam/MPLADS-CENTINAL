import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { documentApi, expenditureApi } from "../../../api/endpoints";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { Input, Label } from "../../../components/ui/Input";
import { useAuth } from "../../../hooks/useAuth";
import type { Project } from "../../../types";

export function FinancialsTab({ project }: { project: Project }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isContractor = user?.role === "CONTRACTOR";

  const expenditureQuery = useQuery({ queryKey: ["expenditure", project._id], queryFn: () => expenditureApi.list(project._id) });
  const documentsQuery = useQuery({ queryKey: ["documents", project._id], queryFn: () => documentApi.list(project._id) });

  const [form, setForm] = useState({ amount: "", category: "Materials & Labour", invoiceNumber: "", vendor: "", justification: "" });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await expenditureApi.submit(project._id, {
        date: new Date().toISOString() as any,
        amount: Number(form.amount),
        category: form.category,
        invoiceNumber: form.invoiceNumber || undefined,
        vendor: form.vendor || undefined,
        justification: form.justification || undefined,
      });
      if (file) {
        await documentApi.upload(project._id, file, {
          type: "INVOICE",
          amount: Number(form.amount),
          invoiceNumber: form.invoiceNumber || undefined,
          vendor: form.vendor || undefined,
        });
      }
      setForm({ amount: "", category: "Materials & Labour", invoiceNumber: "", vendor: "", justification: "" });
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["expenditure", project._id] });
      queryClient.invalidateQueries({ queryKey: ["documents", project._id] });
      queryClient.invalidateQueries({ queryKey: ["project", project._id] });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to submit expenditure");
    } finally {
      setSubmitting(false);
    }
  };

  const spentPercent = project.sanctionedAmount > 0 ? ((project.spentAmount / project.sanctionedAmount) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div><p className="text-xs text-primary-400">Sanctioned</p><p className="text-lg font-bold">₹{project.sanctionedAmount.toLocaleString("en-IN")}</p></div>
        <div><p className="text-xs text-primary-400">Spent</p><p className="text-lg font-bold">₹{project.spentAmount.toLocaleString("en-IN")}</p></div>
        <div><p className="text-xs text-primary-400">Utilization</p><p className="text-lg font-bold">{spentPercent}%</p></div>
      </div>

      {isContractor && (
        <Card>
          <CardHeader title="Submit Expenditure" />
          <CardBody>
            <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Amount (₹)</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div>
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
              </div>
              <div>
                <Label>Invoice Number</Label>
                <Input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
              </div>
              <div>
                <Label>Vendor</Label>
                <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Justification</Label>
                <Input value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Supporting Document (optional)</Label>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-primary-600" />
              </div>
              {error && <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit Expenditure"}</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Expenditure History" />
        <CardBody className="space-y-2">
          {(expenditureQuery.data ?? []).map((e) => (
            <div key={e._id} className="flex items-center justify-between rounded-lg border border-primary-100 px-3 py-2 text-sm">
              <div>
                <p className="font-medium">₹{e.amount.toLocaleString("en-IN")} — {e.category}</p>
                <p className="text-xs text-primary-400">{new Date(e.date).toLocaleDateString()} {e.invoiceNumber ? `· Invoice ${e.invoiceNumber}` : ""}</p>
              </div>
              {!e.justification && <span className="text-xs font-medium text-orange-600">No justification</span>}
            </div>
          ))}
          {(expenditureQuery.data ?? []).length === 0 && <p className="text-sm text-primary-400">No expenditure submitted yet.</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Documents" />
        <CardBody className="space-y-2">
          {(documentsQuery.data ?? []).map((d) => (
            <div key={d._id} className="flex items-center justify-between rounded-lg border border-primary-100 px-3 py-2 text-sm">
              <span>{d.fileName} — {d.type} {d.amount ? `(₹${d.amount.toLocaleString("en-IN")})` : ""}</span>
              <span className="text-xs text-primary-400">{new Date(d.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
          {(documentsQuery.data ?? []).length === 0 && <p className="text-sm text-primary-400">No documents uploaded yet.</p>}
        </CardBody>
      </Card>
    </div>
  );
}
