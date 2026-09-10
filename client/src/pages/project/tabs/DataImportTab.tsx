import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { useRef, useState } from "react";
import { activityApi, importApi, sanctionApi } from "../../../api/endpoints";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { useAuth } from "../../../hooks/useAuth";
import type { ImportSummary, Project } from "../../../types";

interface ActivityImportResult {
  row: number;
  activityId: string;
  created: string[];
}

export function DataImportTab({ project }: { project: Project }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isContractor = user?.role === "CONTRACTOR";
  const inputRef = useRef<HTMLInputElement>(null);

  const sanctionQuery = useQuery({ queryKey: ["sanction", project._id], queryFn: () => sanctionApi.get(project._id) });
  const activitiesQuery = useQuery({ queryKey: ["activities", project._id], queryFn: () => activityApi.list(project._id) });

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary<ActivityImportResult> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approved = sanctionQuery.data?.status === "APPROVED";

  const runImport = async (file: File) => {
    setUploading(true);
    setError(null);
    setSummary(null);
    try {
      const result = await importApi.activities(project._id, file);
      setSummary(result);
      queryClient.invalidateQueries({ queryKey: ["activities", project._id] });
      queryClient.invalidateQueries({ queryKey: ["progress", project._id] });
      queryClient.invalidateQueries({ queryKey: ["expenditure", project._id] });
      queryClient.invalidateQueries({ queryKey: ["site-visits", project._id] });
      queryClient.invalidateQueries({ queryKey: ["project", project._id] });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Import failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {isContractor && (
        <Card>
          <CardHeader title="Upload Daily Activity CSV" subtitle="See docs/CSV_FORMATS.md for the column reference" />
          <CardBody>
            {!approved ? (
              <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                Approve the sanction on the Sanction tab before uploading daily activity.
              </p>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) runImport(f);
                }}
                onClick={() => inputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                  dragging ? "border-primary-500 bg-primary-50" : "border-surface-300 hover:border-primary-400 hover:bg-surface-50"
                }`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-accent text-white">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <p className="font-medium text-primary-800">{uploading ? "Processing…" : "Drop CSV here, or click to browse"}</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && runImport(e.target.files[0])}
                />
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4" /> {error}
              </div>
            )}

            {summary && (
              <div className="mt-4 space-y-2">
                <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  {summary.validRows} of {summary.totalRows} row(s) imported. Detection is running automatically — the
                  officer will see updated findings/risk in real time.
                </p>
                {summary.warnings.map((w, i) => (
                  <p key={i} className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                    ⚠ Row {w.row}: {w.message}
                  </p>
                ))}
                {summary.invalidRows.map((iss, i) => (
                  <p key={i} className="rounded-lg bg-red-50 p-2 text-xs text-red-800">
                    ✗ Row {iss.row}{iss.field ? ` (${iss.field})` : ""}: {iss.message}
                  </p>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Import History" subtitle="Every row ever imported for this project, most recent first" />
        <CardBody className="space-y-2">
          {(activitiesQuery.data ?? []).map((a) => (
            <div key={a._id} className="flex items-center justify-between rounded-lg border border-surface-200 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-primary-900">{a.activityId} — {new Date(a.activityDate).toLocaleDateString()}</p>
                <p className="text-xs text-surface-400">
                  {a.progressPercent !== undefined && `Progress ${a.progressPercent}% · `}
                  {a.expenditureAmount !== undefined && `₹${a.expenditureAmount.toLocaleString("en-IN")} · `}
                  {a.workCompletedDescription || "No description"}
                </p>
              </div>
              <span className="text-xs text-surface-400">{new Date(a.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {(activitiesQuery.data ?? []).length === 0 && <p className="text-sm text-surface-400">No CSV activity imported yet.</p>}
        </CardBody>
      </Card>
    </div>
  );
}
