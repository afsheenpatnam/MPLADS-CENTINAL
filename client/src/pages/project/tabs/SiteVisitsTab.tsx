import { useQuery, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import { useState, type FormEvent } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { siteVisitApi } from "../../../api/endpoints";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { Input, Label } from "../../../components/ui/Input";
import { useAuth } from "../../../hooks/useAuth";
import type { Project } from "../../../types";
import { sanctionApi } from "../../../api/endpoints";

const projectIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export function SiteVisitsTab({ project }: { project: Project }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isContractor = user?.role === "CONTRACTOR";

  const visitsQuery = useQuery({ queryKey: ["site-visits", project._id], queryFn: () => siteVisitApi.list(project._id) });
  const sanctionQuery = useQuery({ queryKey: ["sanction", project._id], queryFn: () => sanctionApi.get(project._id) });

  const [form, setForm] = useState({ latitude: String(project.latitude), longitude: String(project.longitude), remarks: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await siteVisitApi.submit(project._id, {
        date: new Date().toISOString() as any,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        remarks: form.remarks || undefined,
        status: "COMPLETED",
      });
      setForm({ ...form, remarks: "" });
      queryClient.invalidateQueries({ queryKey: ["site-visits", project._id] });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to record site visit");
    } finally {
      setSubmitting(false);
    }
  };

  const visits = visitsQuery.data ?? [];
  const requiredVisits = sanctionQuery.data?.requiredVisits ?? 4;
  const completed = visits.filter((v) => v.status === "COMPLETED").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <p className="text-sm text-primary-600">
          <strong className="text-primary-900">{completed}</strong> of <strong className="text-primary-900">{requiredVisits}</strong> required visits completed
        </p>
      </div>

      <Card>
        <CardHeader title="Site Location Map" />
        <CardBody style={{ height: 320 }}>
          <MapContainer center={[project.latitude, project.longitude]} zoom={13} style={{ height: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
            <Marker position={[project.latitude, project.longitude]} icon={projectIcon}>
              <Popup>Registered project location</Popup>
            </Marker>
            {visits.map((v) => (
              <Marker key={v._id} position={[v.latitude, v.longitude]} icon={projectIcon}>
                <Popup>
                  Visit on {new Date(v.date).toLocaleDateString()}
                  <br />
                  {v.remarks}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </CardBody>
      </Card>

      {isContractor && (
        <Card>
          <CardHeader title="Record Site Visit" />
          <CardBody>
            <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>Latitude</Label>
                <Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} required />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} required />
              </div>
              <div>
                <Label>Remarks</Label>
                <Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
              </div>
              {error && <p className="sm:col-span-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="sm:col-span-3">
                <Button type="submit" disabled={submitting}>{submitting ? "Recording..." : "Record Visit"}</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Visit History" />
        <CardBody className="space-y-2">
          {visits.map((v) => (
            <div key={v._id} className="flex items-center justify-between rounded-lg border border-primary-100 px-3 py-2 text-sm">
              <span>{new Date(v.date).toLocaleDateString()} — {v.remarks || "No remarks"}</span>
              <span className="text-xs font-medium text-primary-500">{v.status}</span>
            </div>
          ))}
          {visits.length === 0 && <p className="text-sm text-primary-400">No site visits recorded yet.</p>}
        </CardBody>
      </Card>
    </div>
  );
}
