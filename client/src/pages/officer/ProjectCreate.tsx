import { ArrowLeft, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { projectApi } from "../../api/endpoints";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Input, Label, Textarea } from "../../components/ui/Input";

const initial = {
  name: "",
  description: "",
  projectType: "Road Construction",
  state: "",
  district: "",
  location: "",
  latitude: "",
  longitude: "",
  sanctionedAmount: "",
  startDate: "",
  endDate: "",
  approvedWork: "",
  approvedQuantity: "",
};

export function ProjectCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const project = await projectApi.create({
        name: form.name,
        description: form.description,
        projectType: form.projectType,
        state: form.state,
        district: form.district,
        location: form.location,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        sanctionedAmount: Number(form.sanctionedAmount),
        startDate: form.startDate as unknown as string,
        endDate: form.endDate as unknown as string,
        approvedWork: form.approvedWork,
        approvedQuantity: Number(form.approvedQuantity || 0),
      } as any);
      navigate(`/officer/projects/${project._id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/officer" className="inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Create Project</h1>
          <p className="text-sm text-surface-500">Manual entry — one project at a time, no sanction or contractor auto-assignment.</p>
        </div>
        <Link to="/officer/projects/import">
          <Button variant="secondary">
            <Upload className="h-4 w-4" /> Import via CSV instead
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader title="Project Baseline" subtitle="Define the project before creating its sanction and conditions" />
        <CardBody>
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Project Name</Label>
              <Input value={form.name} onChange={set("name")} required />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={set("description")} rows={2} />
            </div>
            <div>
              <Label>Project Type</Label>
              <Input value={form.projectType} onChange={set("projectType")} required />
            </div>
            <div>
              <Label>Sanctioned Amount (₹)</Label>
              <Input type="number" value={form.sanctionedAmount} onChange={set("sanctionedAmount")} required />
            </div>
            <div>
              <Label>State</Label>
              <Input value={form.state} onChange={set("state")} required />
            </div>
            <div>
              <Label>District</Label>
              <Input value={form.district} onChange={set("district")} required />
            </div>
            <div className="sm:col-span-2">
              <Label>Location</Label>
              <Input value={form.location} onChange={set("location")} required />
            </div>
            <div>
              <Label>Latitude</Label>
              <Input type="number" step="any" value={form.latitude} onChange={set("latitude")} required />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input type="number" step="any" value={form.longitude} onChange={set("longitude")} required />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={set("startDate")} required />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={form.endDate} onChange={set("endDate")} required />
            </div>
            <div className="sm:col-span-2">
              <Label>Approved Work</Label>
              <Textarea value={form.approvedWork} onChange={set("approvedWork")} rows={2} />
            </div>
            <div>
              <Label>Approved Quantity</Label>
              <Input type="number" value={form.approvedQuantity} onChange={set("approvedQuantity")} />
            </div>

            {error && <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
