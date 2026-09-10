import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { clarificationApi, detectionApi, exceptionApi, investigationApi } from "../../../api/endpoints";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { StatusBadge } from "../../../components/ui/Badge";
import { Input, Label, Select, Textarea } from "../../../components/ui/Input";
import { useAuth } from "../../../hooks/useAuth";
import type { Project } from "../../../types";

export function InvestigationTab({ project }: { project: Project }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOfficer = user?.role === "OFFICER";
  const isContractor = user?.role === "CONTRACTOR";

  const clarificationsQuery = useQuery({ queryKey: ["clarifications", project._id], queryFn: () => clarificationApi.list(project._id) });
  const exceptionsQuery = useQuery({ queryKey: ["exceptions", project._id], queryFn: () => exceptionApi.list(project._id) });
  const findingsQuery = useQuery({ queryKey: ["findings", project._id], queryFn: () => detectionApi.findings(project._id) });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["clarifications", project._id] });
    queryClient.invalidateQueries({ queryKey: ["exceptions", project._id] });
    queryClient.invalidateQueries({ queryKey: ["findings", project._id] });
  };

  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [exceptionForm, setExceptionForm] = useState({ reason: "", ruleId: "VISIT_001", requestedAdjustment: "1" });
  const [resolveForm, setResolveForm] = useState({ findingId: "", status: "RESOLVED" as "RESOLVED" | "DISMISSED", note: "" });

  const openFindings = (findingsQuery.data ?? []).filter((f) => f.status !== "RESOLVED" && f.status !== "DISMISSED");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Clarifications" />
        <CardBody className="space-y-3">
          {(clarificationsQuery.data ?? []).map((c) => (
            <div key={c._id} className="rounded-lg border border-primary-100 p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-primary-900">{c.message}</p>
                <StatusBadge status={c.status} />
              </div>
              {c.response && <p className="mt-1 rounded bg-primary-50 p-2 text-primary-700">Contractor response: {c.response}</p>}

              {isContractor && c.status === "PENDING" && (
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="Your response..."
                    value={responseText[c._id] ?? ""}
                    onChange={(e) => setResponseText({ ...responseText, [c._id]: e.target.value })}
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      await clarificationApi.respond(c._id, { response: responseText[c._id] ?? "" });
                      invalidateAll();
                    }}
                  >
                    Respond
                  </Button>
                </div>
              )}

              {isOfficer && c.status === "RESPONDED" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={async () => { await clarificationApi.review(c._id, { decision: "ACCEPT" }); invalidateAll(); }}>
                    Accept Explanation
                  </Button>
                  <Button size="sm" variant="outline" onClick={async () => { await clarificationApi.review(c._id, { decision: "NEEDS_MORE_INFO" }); invalidateAll(); }}>
                    Request More Info
                  </Button>
                  <Button size="sm" onClick={async () => { await clarificationApi.review(c._id, { decision: "RESOLVE" }); invalidateAll(); }}>
                    Resolve Finding(s)
                  </Button>
                </div>
              )}
            </div>
          ))}
          {(clarificationsQuery.data ?? []).length === 0 && <p className="text-sm text-primary-400">No clarifications requested yet.</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Exception Requests" subtitle="Contractor-requested adjustments to a condition or rule requirement" />
        <CardBody className="space-y-3">
          {(exceptionsQuery.data ?? []).map((ex) => (
            <div key={ex._id} className="flex items-center justify-between rounded-lg border border-primary-100 p-3 text-sm">
              <div>
                <p className="font-medium text-primary-900">{ex.reason}</p>
                <p className="text-xs text-primary-400">Rule: {ex.ruleId ?? "-"} · Adjustment: {ex.requestedAdjustment}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={ex.status} />
                {isOfficer && ex.status === "PENDING" && (
                  <>
                    <Button size="sm" variant="outline" onClick={async () => { await exceptionApi.review(ex._id, { decision: "APPROVED" }); invalidateAll(); }}>
                      Approve
                    </Button>
                    <Button size="sm" variant="danger" onClick={async () => { await exceptionApi.review(ex._id, { decision: "REJECTED" }); invalidateAll(); }}>
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {(exceptionsQuery.data ?? []).length === 0 && <p className="text-sm text-primary-400">No exception requests yet.</p>}

          {isContractor && (
            <form
              className="grid grid-cols-1 gap-2 rounded-lg bg-primary-50 p-3 sm:grid-cols-4"
              onSubmit={async (e) => {
                e.preventDefault();
                await exceptionApi.request(project._id, {
                  reason: exceptionForm.reason,
                  ruleId: exceptionForm.ruleId,
                  requestedAdjustment: Number(exceptionForm.requestedAdjustment),
                });
                setExceptionForm({ ...exceptionForm, reason: "" });
                invalidateAll();
              }}
            >
              <div className="sm:col-span-2">
                <Label>Reason</Label>
                <Input value={exceptionForm.reason} onChange={(e) => setExceptionForm({ ...exceptionForm, reason: e.target.value })} required />
              </div>
              <div>
                <Label>Rule</Label>
                <Select value={exceptionForm.ruleId} onChange={(e) => setExceptionForm({ ...exceptionForm, ruleId: e.target.value })}>
                  <option value="VISIT_001">Site Visit Requirement</option>
                  <option value="SANCTION_001">Timeline</option>
                </Select>
              </div>
              <div>
                <Label>Adjustment</Label>
                <Input type="number" value={exceptionForm.requestedAdjustment} onChange={(e) => setExceptionForm({ ...exceptionForm, requestedAdjustment: e.target.value })} />
              </div>
              <div className="sm:col-span-4">
                <Button type="submit" size="sm">Request Exception</Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>

      {isOfficer && (
        <Card>
          <CardHeader title="Resolve a Finding" subtitle="The officer makes the final determination" />
          <CardBody>
            <form
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!resolveForm.findingId) return;
                await investigationApi.resolve(project._id, {
                  findingId: resolveForm.findingId,
                  status: resolveForm.status,
                  resolutionNote: resolveForm.note,
                });
                setResolveForm({ findingId: "", status: "RESOLVED", note: "" });
                invalidateAll();
              }}
            >
              <div>
                <Label>Finding</Label>
                <Select value={resolveForm.findingId} onChange={(e) => setResolveForm({ ...resolveForm, findingId: e.target.value })} required>
                  <option value="">Select an open finding...</option>
                  {openFindings.map((f) => (
                    <option key={f._id} value={f._id}>{f.title}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Decision</Label>
                <Select value={resolveForm.status} onChange={(e) => setResolveForm({ ...resolveForm, status: e.target.value as any })}>
                  <option value="RESOLVED">Resolved</option>
                  <option value="DISMISSED">Dismissed</option>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Resolution Note</Label>
                <Textarea rows={2} value={resolveForm.note} onChange={(e) => setResolveForm({ ...resolveForm, note: e.target.value })} required />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Submit Decision</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
