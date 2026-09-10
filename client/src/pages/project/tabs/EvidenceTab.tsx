import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { fileUrl } from "../../../api/client";
import { evidenceApi } from "../../../api/endpoints";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { Input, Label } from "../../../components/ui/Input";
import { StatusBadge } from "../../../components/ui/Badge";
import { useAuth } from "../../../hooks/useAuth";
import type { Evidence, Project } from "../../../types";

export function EvidenceTab({ project }: { project: Project }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isContractor = user?.role === "CONTRACTOR";

  const evidenceQuery = useQuery({ queryKey: ["evidence", project._id], queryFn: () => evidenceApi.list(project._id) });
  const evidence = evidenceQuery.data ?? [];

  const [file, setFile] = useState<File | null>(null);
  const [lat, setLat] = useState(String(project.latitude));
  const [lng, setLng] = useState(String(project.longitude));
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await evidenceApi.upload(project._id, file, { latitude: Number(lat), longitude: Number(lng) });
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["evidence", project._id] });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to upload evidence");
    } finally {
      setUploading(false);
    }
  };

  const compared = evidence.find((e) => e._id === compareId);
  const compareTarget = compared?.similarityResults[0]
    ? evidence.find((e) => e._id === compared.similarityResults[0].comparedEvidenceId)
    : undefined;

  return (
    <div className="space-y-4">
      {isContractor && (
        <Card>
          <CardHeader title="Upload Evidence" subtitle="Geo-tagged photographs are automatically hashed and compared for reuse" />
          <CardBody>
            <form onSubmit={upload} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <Label>File</Label>
                <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-primary-600" />
              </div>
              <div>
                <Label>Latitude</Label>
                <Input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} />
              </div>
              {error && <p className="sm:col-span-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="sm:col-span-3">
                <Button type="submit" disabled={!file || uploading}>{uploading ? "Uploading..." : "Upload"}</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {evidence.map((e) => (
          <EvidenceCard key={e._id} evidence={e} onCompare={() => setCompareId(e._id)} />
        ))}
        {evidence.length === 0 && <p className="col-span-full text-sm text-primary-400">No evidence uploaded yet.</p>}
      </div>

      {compared && compareTarget && (
        <Card>
          <CardHeader title="Side-by-Side Comparison" subtitle={`${compared.similarityResults[0]?.similarityScore.toFixed(1)}% similarity`} />
          <CardBody className="grid grid-cols-2 gap-4">
            <EvidencePreview evidence={compared} label="New Upload" />
            <EvidencePreview evidence={compareTarget} label="Previously Uploaded" />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function EvidenceCard({ evidence, onCompare }: { evidence: Evidence; onCompare: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-primary-200 bg-white">
      <div className="flex aspect-video items-center justify-center bg-primary-50">
        {evidence.fileType.startsWith("image/") ? (
          <img src={fileUrl(evidence.filePath)} alt={evidence.fileName} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-primary-400">No preview</span>
        )}
      </div>
      <div className="space-y-1 p-2 text-xs">
        <p className="truncate font-medium text-primary-800">{evidence.fileName}</p>
        <StatusBadge status={evidence.validationStatus} />
        {evidence.similarityResults.length > 0 && (
          <button onClick={onCompare} className="block text-orange-600 underline">
            {evidence.similarityResults[0].similarityScore.toFixed(1)}% similar — compare
          </button>
        )}
      </div>
    </div>
  );
}

function EvidencePreview({ evidence, label }: { evidence: Evidence; label: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase text-primary-500">{label}</p>
      <img src={fileUrl(evidence.filePath)} alt={evidence.fileName} className="w-full rounded-lg border border-primary-200" />
      <dl className="mt-2 space-y-1 text-xs text-primary-600">
        <div className="flex justify-between"><dt>Uploaded</dt><dd>{new Date(evidence.createdAt).toLocaleString()}</dd></div>
        <div className="flex justify-between"><dt>GPS</dt><dd>{evidence.latitude?.toFixed(4)}, {evidence.longitude?.toFixed(4)}</dd></div>
        <div className="flex justify-between"><dt>File Hash</dt><dd className="truncate max-w-[140px]">{evidence.fileHash.slice(0, 16)}...</dd></div>
      </dl>
    </div>
  );
}
