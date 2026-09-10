import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { conditionApi, sanctionApi } from "../../../api/endpoints";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { Input, Label, Select, Textarea } from "../../../components/ui/Input";
import { useAuth } from "../../../hooks/useAuth";
import type { Project } from "../../../types";

export function SanctionTab({ project }: { project: Project }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOfficer = user?.role === "OFFICER";
  const isContractor = user?.role === "CONTRACTOR";
  const [approving, setApproving] = useState(false);

  const sanctionQuery = useQuery({ queryKey: ["sanction", project._id], queryFn: () => sanctionApi.get(project._id) });
  const conditionsQuery = useQuery({ queryKey: ["conditions", project._id], queryFn: () => conditionApi.list(project._id) });

  const approve = async () => {
    if (!sanctionQuery.data) return;
    setApproving(true);
    try {
      await sanctionApi.approve(sanctionQuery.data._id);
      queryClient.invalidateQueries({ queryKey: ["sanction", project._id] });
      queryClient.invalidateQueries({ queryKey: ["project", project._id] });
      queryClient.invalidateQueries({ queryKey: ["sanction-pending"] });
    } finally {
      setApproving(false);
    }
  };

  const [form, setForm] = useState({
    sanctionedAmount: String(project.sanctionedAmount || ""),
    duration: "12",
    approvedWork: project.approvedWork || "",
    approvedQuantity: String(project.approvedQuantity || ""),
    requiredVisits: "8",
  });
  const [conditionForm, setConditionForm] = useState({
    ruleId: "",
    category: "TIME_PROGRESS",
    parameter: "actualProgress",
    operator: ">=",
    expectedValue: "",
    severity: "MEDIUM",
  });
  const [error, setError] = useState<string | null>(null);

  const createSanction = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await sanctionApi.create(project._id, {
        sanctionedAmount: Number(form.sanctionedAmount),
        duration: Number(form.duration),
        approvedWork: form.approvedWork,
        approvedQuantity: Number(form.approvedQuantity || 0),
        requiredVisits: Number(form.requiredVisits),
      } as any);
      queryClient.invalidateQueries({ queryKey: ["sanction", project._id] });
      queryClient.invalidateQueries({ queryKey: ["project", project._id] });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to create sanction");
    }
  };

  const createCondition = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await conditionApi.create(project._id, {
        ruleId: conditionForm.ruleId,
        category: conditionForm.category as any,
        parameter: conditionForm.parameter,
        operator: conditionForm.operator as any,
        expectedValue: Number(conditionForm.expectedValue),
        severity: conditionForm.severity as any,
      });
      queryClient.invalidateQueries({ queryKey: ["conditions", project._id] });
      setConditionForm({ ...conditionForm, ruleId: "", expectedValue: "" });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to create condition");
    }
  };

  const sanction = sanctionQuery.data;

  return (
    <div className="space-y-4">
      {sanction ? (
        <Card>
          <CardHeader
            title="Sanction"
            subtitle="Sanctioned baseline for this project — all detection compares actual activity against this"
            action={
              sanction.status === "APPROVED" ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  <Clock className="h-3.5 w-3.5" /> Pending Approval
                </span>
              )
            }
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div><p className="text-xs text-primary-400">Sanctioned Amount</p><p className="font-semibold">₹{sanction.sanctionedAmount.toLocaleString("en-IN")}</p></div>
              <div><p className="text-xs text-primary-400">Duration</p><p className="font-semibold">{sanction.duration} months</p></div>
              <div><p className="text-xs text-primary-400">Required Visits</p><p className="font-semibold">{sanction.requiredVisits}</p></div>
              <div><p className="text-xs text-primary-400">Reporting Frequency</p><p className="font-semibold">Every {sanction.reportingFrequencyDays} day(s)</p></div>
              <div><p className="text-xs text-primary-400">Evidence Required</p><p className="font-semibold">{sanction.evidenceRequired ? "Yes" : "No"}</p></div>
              <div><p className="text-xs text-primary-400">Expenditure Justification</p><p className="font-semibold">{sanction.expenditureJustificationRequired ? "Required" : "Not required"}</p></div>
              <div className="sm:col-span-3"><p className="text-xs text-primary-400">Approved Work</p><p className="font-semibold">{sanction.approvedWork}</p></div>
            </div>

            {[...sanction.financialConditions, ...sanction.timelineConditions, ...sanction.workConditions, ...sanction.evidenceConditions, ...sanction.visitConditions, ...sanction.otherConditions].length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary-400">Conditions</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-primary-700">
                  {[...sanction.financialConditions, ...sanction.timelineConditions, ...sanction.workConditions, ...sanction.evidenceConditions, ...sanction.visitConditions, ...sanction.otherConditions].map(
                    (c, i) => (
                      <li key={i}>{c}</li>
                    )
                  )}
                </ul>
              </div>
            )}

            {isContractor && sanction.status === "PENDING_APPROVAL" && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="mb-2 text-sm text-amber-800">
                  Review the sanction above carefully. You cannot submit progress, expenditure, site visits, or evidence
                  until you approve it.
                </p>
                <Button onClick={approve} disabled={approving}>
                  {approving ? "Approving..." : "Approve Sanction"}
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      ) : isOfficer ? (
        <Card>
          <CardHeader title="Create Sanction" subtitle="No sanction defined yet — this project cannot go live without one" />
          <CardBody>
            <form onSubmit={createSanction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Sanctioned Amount (₹)</Label>
                <Input type="number" value={form.sanctionedAmount} onChange={(e) => setForm({ ...form, sanctionedAmount: e.target.value })} required />
              </div>
              <div>
                <Label>Duration (months)</Label>
                <Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} required />
              </div>
              <div>
                <Label>Required Site Visits</Label>
                <Input type="number" value={form.requiredVisits} onChange={(e) => setForm({ ...form, requiredVisits: e.target.value })} required />
              </div>
              <div>
                <Label>Approved Quantity</Label>
                <Input type="number" value={form.approvedQuantity} onChange={(e) => setForm({ ...form, approvedQuantity: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Approved Work</Label>
                <Textarea value={form.approvedWork} onChange={(e) => setForm({ ...form, approvedWork: e.target.value })} rows={2} required />
              </div>
              {error && <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="sm:col-span-2">
                <Button type="submit">Create Sanction</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : (
        <p className="text-sm text-primary-500">No sanction has been defined for this project yet.</p>
      )}

      <Card>
        <CardHeader title="Conditions" subtitle="Officer-defined conditions evaluated by the rule engine" />
        <CardBody className="space-y-3">
          {(conditionsQuery.data ?? []).map((c) => (
            <div key={c._id} className="flex items-center justify-between rounded-lg border border-primary-100 px-3 py-2 text-sm">
              <span>
                <strong>{c.parameter}</strong> {c.operator} {String(c.expectedValue)} <span className="text-primary-400">({c.category})</span>
              </span>
              <span className="text-xs font-semibold text-primary-500">{c.severity}</span>
            </div>
          ))}
          {(conditionsQuery.data ?? []).length === 0 && <p className="text-sm text-primary-400">No conditions defined yet.</p>}

          {isOfficer && (
            <form onSubmit={createCondition} className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-primary-50 p-3 sm:grid-cols-5">
              <Input placeholder="Rule ID" value={conditionForm.ruleId} onChange={(e) => setConditionForm({ ...conditionForm, ruleId: e.target.value })} required />
              <Select value={conditionForm.category} onChange={(e) => setConditionForm({ ...conditionForm, category: e.target.value })}>
                <option value="TIME_PROGRESS">Time/Progress</option>
                <option value="FINANCIAL">Financial</option>
                <option value="WORK_EVIDENCE">Work/Evidence</option>
                <option value="QUANTITY">Quantity</option>
                <option value="VISIT">Visit</option>
                <option value="QUALITY">Quality</option>
                <option value="OTHER">Other</option>
              </Select>
              <Input placeholder="Parameter (e.g. actualProgress)" value={conditionForm.parameter} onChange={(e) => setConditionForm({ ...conditionForm, parameter: e.target.value })} required />
              <Select value={conditionForm.operator} onChange={(e) => setConditionForm({ ...conditionForm, operator: e.target.value })}>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
                <option value="==">==</option>
                <option value="!=">!=</option>
              </Select>
              <Input placeholder="Expected value" type="number" value={conditionForm.expectedValue} onChange={(e) => setConditionForm({ ...conditionForm, expectedValue: e.target.value })} required />
              <Button type="submit" size="sm" className="col-span-2 sm:col-span-1">Add Condition</Button>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
