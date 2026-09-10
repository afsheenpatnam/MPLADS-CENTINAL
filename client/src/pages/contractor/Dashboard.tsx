import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ClipboardCheck, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { projectApi, sanctionApi } from "../../api/endpoints";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";

export function ContractorDashboard() {
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => projectApi.list() });
  const pendingQuery = useQuery({ queryKey: ["sanction-pending"], queryFn: () => sanctionApi.pending() });

  if (projectsQuery.isLoading) return <Spinner label="Loading your projects..." />;
  const projects = projectsQuery.data ?? [];
  const pending = pendingQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">My Assigned Projects</h1>
        <p className="text-sm text-primary-500">Submit progress, expenditure, site visits, and evidence for each project.</p>
      </div>

      {pending.length > 0 && (
        <Card>
          <CardHeader
            title="Pending Sanction Approvals"
            subtitle="Review and approve before you can submit any activity for these projects"
          />
          <CardBody className="space-y-2">
            {pending.map((s) => (
              <div key={s._id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-amber-600" />
                  <div>
                    <p className="font-medium text-primary-900">{s.projectId.name}</p>
                    <p className="text-xs text-primary-500">
                      {s.projectId.projectCode} · ₹{s.sanctionedAmount.toLocaleString("en-IN")} · {s.duration} month(s)
                    </p>
                  </div>
                </div>
                <Link to={`/contractor/projects/${s.projectId._id}`}>
                  <Button size="sm">Review &amp; Approve</Button>
                </Link>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Card key={p._id}>
            <CardBody className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-primary-900">{p.name}</h3>
                  <p className="flex items-center gap-1 text-xs text-primary-400">
                    <MapPin className="h-3 w-3" /> {p.location}, {p.district}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>

              <p className="flex items-center gap-1 text-xs text-primary-500">
                <CalendarClock className="h-3 w-3" /> Deadline {new Date(p.endDate).toLocaleDateString()}
              </p>

              <div>
                <div className="mb-1 flex justify-between text-xs text-primary-500">
                  <span>Progress</span>
                  <span>{p.actualProgress.toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-primary-100">
                  <div className="h-2 rounded-full bg-gradient-primary" style={{ width: `${Math.min(100, p.actualProgress)}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-primary-500">
                <span>Spent: ₹{p.spentAmount.toLocaleString("en-IN")}</span>
                <span>Sanctioned: ₹{p.sanctionedAmount.toLocaleString("en-IN")}</span>
              </div>

              <Link to={`/contractor/projects/${p._id}`}>
                <Button size="sm" className="w-full">Open Project</Button>
              </Link>
            </CardBody>
          </Card>
        ))}
        {projects.length === 0 && <p className="text-sm text-primary-400">No projects assigned to you yet.</p>}
      </div>
    </div>
  );
}
