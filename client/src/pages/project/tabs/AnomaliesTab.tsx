import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, MessageSquareWarning } from "lucide-react";
import { useState } from "react";
import { clarificationApi, detectionApi } from "../../../api/endpoints";
import { Button } from "../../../components/ui/Button";
import { ClassificationBadge, SeverityBadge, StatusBadge } from "../../../components/ui/Badge";
import { Textarea } from "../../../components/ui/Input";
import { useAuth } from "../../../hooks/useAuth";
import type { Finding, Project } from "../../../types";

export function AnomaliesTab({ project }: { project: Project }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOfficer = user?.role === "OFFICER";

  const findingsQuery = useQuery({ queryKey: ["findings", project._id], queryFn: () => detectionApi.findings(project._id) });
  const findings = findingsQuery.data ?? [];

  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleSelect = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const requestClarification = async () => {
    if (selected.length === 0 || !message.trim()) return;
    setSubmitting(true);
    try {
      await clarificationApi.request(project._id, { findingIds: selected, message });
      setSelected([]);
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["findings", project._id] });
      queryClient.invalidateQueries({ queryKey: ["clarifications", project._id] });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {findings.length === 0 && (
        <p className="text-sm text-primary-400">No findings yet. Run detection from the top of the page to analyze this project.</p>
      )}

      <div className="space-y-2">
        {findings.map((f) => (
          <FindingRow
            key={f._id}
            finding={f}
            expanded={expanded === f._id}
            onToggle={() => setExpanded(expanded === f._id ? null : f._id)}
            selectable={isOfficer && f.status !== "RESOLVED" && f.status !== "DISMISSED"}
            selected={selected.includes(f._id)}
            onSelect={() => toggleSelect(f._id)}
          />
        ))}
      </div>

      {isOfficer && selected.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <MessageSquareWarning className="h-4 w-4" /> Request clarification for {selected.length} finding(s)
          </p>
          <Textarea rows={2} placeholder="Describe what you need the contractor to explain..." value={message} onChange={(e) => setMessage(e.target.value)} />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={requestClarification} disabled={submitting || !message.trim()}>
              {submitting ? "Sending..." : "Request Clarification"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FindingRow({
  finding,
  expanded,
  onToggle,
  selectable,
  selected,
  onSelect,
}: {
  finding: Finding;
  expanded: boolean;
  onToggle: () => void;
  selectable: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="rounded-xl border border-primary-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        {selectable && <input type="checkbox" checked={selected} onChange={onSelect} className="h-4 w-4" />}
        <button onClick={onToggle} className="flex flex-1 items-center justify-between gap-3 text-left">
          <div>
            <p className="font-medium text-primary-900">{finding.title}</p>
            <p className="text-xs text-primary-400">{finding.category} · {finding.type}</p>
          </div>
          <div className="flex items-center gap-2">
            <ClassificationBadge classification={finding.classification} />
            <SeverityBadge severity={finding.severity} />
            <StatusBadge status={finding.status} />
            {expanded ? <ChevronUp className="h-4 w-4 text-primary-400" /> : <ChevronDown className="h-4 w-4 text-primary-400" />}
          </div>
        </button>
      </div>
      {expanded && (
        <div className="space-y-2 border-t border-primary-100 px-4 py-3 text-sm">
          <p className="text-primary-600">{finding.description}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Expected" value={String(finding.expectedValue ?? "-")} />
            <Field label="Actual" value={String(finding.actualValue ?? "-")} />
            <Field label="Deviation" value={finding.deviation !== undefined ? String(finding.deviation) : "-"} />
            <Field label="Confidence" value={`${Math.round(finding.confidence * 100)}%`} />
            <Field label="Rule" value={finding.ruleId ?? "-"} />
            <Field label="Source" value={finding.source} />
          </div>
          <p className="rounded-lg bg-primary-50 px-3 py-2 text-primary-700">
            <strong>Recommended action:</strong> {finding.recommendedAction}
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-primary-400">{label}</p>
      <p className="font-medium text-primary-800">{value}</p>
    </div>
  );
}
