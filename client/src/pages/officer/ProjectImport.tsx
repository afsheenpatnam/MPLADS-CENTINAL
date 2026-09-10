import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { importApi } from "../../api/endpoints";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import type { ImportSummary } from "../../types";

interface ProjectImportResult {
  row: number;
  projectCode: string;
  contractorEmail: string;
  contractorCreated: boolean;
  contractorTempPassword?: string;
}

type Stage = "idle" | "preview" | "uploading" | "done" | "error";

export function ProjectImportPage() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [headerPreview, setHeaderPreview] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [stage, setStage] = useState<Stage>("idle");
  const [summary, setSummary] = useState<ImportSummary<ProjectImportResult> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const readPreview = async (f: File) => {
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    setHeaderPreview(lines[0]?.split(",").map((h) => h.trim()) ?? []);
    setRowCount(Math.max(0, lines.length - 1));
    setFile(f);
    setStage("preview");
    setSummary(null);
    setError(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) readPreview(dropped);
  };

  const runImport = async () => {
    if (!file) return;
    setStage("uploading");
    setError(null);
    try {
      const result = await importApi.projects(file);
      setSummary(result);
      setStage("done");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-summary"] });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Import failed");
      setStage("error");
    }
  };

  const reset = () => {
    setFile(null);
    setSummary(null);
    setStage("idle");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/officer" className="inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Import Project Baseline</h1>
          <p className="text-sm text-surface-500">
            Upload a CSV to create a project, auto-generate its sanction, and assign (or create) its contractor.
          </p>
        </div>
        <Link to="/officer/projects/new">
          <Button variant="outline">Create manually instead</Button>
        </Link>
      </div>

      <Card>
        <CardHeader title="1. Select CSV" subtitle="See docs/CSV_FORMATS.md for the full column reference" />
        <CardBody>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
              dragging ? "border-primary-500 bg-primary-50" : "border-surface-300 hover:border-primary-400 hover:bg-surface-50"
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary text-white">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <p className="font-medium text-primary-800">{file ? file.name : "Drop CSV here, or click to browse"}</p>
            <p className="text-xs text-surface-400">CSV only · one row per project</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && readPreview(e.target.files[0])}
            />
          </div>

          {stage === "preview" && (
            <div className="mt-4 space-y-3 rounded-xl bg-surface-50 p-4">
              <p className="text-sm font-medium text-primary-800">
                Detected {headerPreview.length} column(s), {rowCount} data row(s)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {headerPreview.map((h) => (
                  <span key={h} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-primary-600 shadow-sm">
                    {h}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={runImport}>
                  <Upload className="h-4 w-4" /> Validate &amp; Import
                </Button>
                <Button variant="outline" onClick={reset}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {stage === "uploading" && <p className="mt-4 text-sm text-primary-600">Uploading, validating, and processing rows…</p>}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" /> {error}
            </div>
          )}
        </CardBody>
      </Card>

      {summary && (
        <Card>
          <CardHeader
            title="Import Status"
            subtitle={summary.validRows > 0 ? "Import successful" : "Import completed with no valid rows"}
          />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total Rows" value={summary.totalRows} />
              <Stat label="Imported" value={summary.validRows} accent="text-emerald-600" />
              <Stat label="Warnings" value={summary.warnings.length} accent="text-amber-600" />
              <Stat label="Errors" value={summary.invalidRows.length} accent="text-red-600" />
            </div>

            {summary.results.length > 0 && (
              <div className="space-y-1.5">
                {summary.results.map((r) => (
                  <div key={r.row} className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Row {r.row}: project <strong>{r.projectCode}</strong> created, contractor {r.contractorEmail}
                    {r.contractorCreated && (
                      <span className="ml-1 rounded bg-white px-1.5 py-0.5 text-xs">
                        new account — temp password: {r.contractorTempPassword}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {summary.warnings.length > 0 && (
              <div className="space-y-1.5">
                {summary.warnings.map((w, i) => (
                  <div key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    ⚠ Row {w.row}{w.field ? ` (${w.field})` : ""}: {w.message}
                  </div>
                ))}
              </div>
            )}

            {summary.invalidRows.length > 0 && (
              <div className="space-y-1.5">
                {summary.invalidRows.map((iss, i) => (
                  <div key={i} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                    ✗ Row {iss.row}{iss.field ? ` (${iss.field})` : ""}: {iss.message}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {summary.validRows > 0 && (
                <Link to="/officer">
                  <Button>Go to Dashboard</Button>
                </Link>
              )}
              <Button variant="outline" onClick={reset}>
                Import Another File
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl bg-surface-50 p-3 text-center">
      <p className={`text-xl font-bold ${accent ?? "text-primary-900"}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-surface-400">{label}</p>
    </div>
  );
}
