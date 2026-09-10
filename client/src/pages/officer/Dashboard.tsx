import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FolderKanban, Gauge, Inbox, PlusCircle, ShieldAlert, TrendingDown, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { projectApi } from "../../api/endpoints";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Select } from "../../components/ui/Input";
import { RiskBadge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { StatCard } from "../../components/ui/StatCard";
import type { Project } from "../../types";

const RISK_COLORS: Record<string, string> = {
  LOW: "#10B981",
  MEDIUM: "#F59E0B",
  HIGH: "#EA580C",
  CRITICAL: "#DC2626",
};

export function OfficerDashboard() {
  const [district, setDistrict] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [status, setStatus] = useState("");

  const summaryQuery = useQuery({ queryKey: ["project-summary"], queryFn: projectApi.summary });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => projectApi.list() });

  const projects = projectsQuery.data ?? [];

  const districts = useMemo(() => Array.from(new Set(projects.map((p) => p.district))).sort(), [projects]);

  const filtered = useMemo(
    () =>
      projects.filter(
        (p) => (!district || p.district === district) && (!riskLevel || p.riskLevel === riskLevel) && (!status || p.status === status)
      ),
    [projects, district, riskLevel, status]
  );

  // Every one of the officer's projects, not just flagged ones — a freshly imported project
  // has no risk computed yet and must still be reachable from this table. Flagged projects
  // (by priority OR risk level — the priority engine can elevate a MEDIUM-risk project to
  // CRITICAL priority) sort to the top; everything else follows by most recently updated.
  const displayedProjects = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const aFlagged = a.priority === "HIGH" || a.priority === "CRITICAL" || a.riskLevel === "HIGH" || a.riskLevel === "CRITICAL";
        const bFlagged = b.priority === "HIGH" || b.priority === "CRITICAL" || b.riskLevel === "HIGH" || b.riskLevel === "CRITICAL";
        if (aFlagged !== bFlagged) return aFlagged ? -1 : 1;
        if (aFlagged && bFlagged) return b.riskScore - a.riskScore;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
    [filtered]
  );

  const riskDistribution = useMemo(() => {
    const counts: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const p of filtered) counts[p.riskLevel] = (counts[p.riskLevel] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of filtered) counts[p.status] = (counts[p.status] ?? 0) + 1;
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [filtered]);

  const expenditureVsProgress = useMemo(
    () =>
      filtered.map((p) => ({
        name: p.projectCode,
        expenditurePercent: p.sanctionedAmount > 0 ? Math.round((p.spentAmount / p.sanctionedAmount) * 100) : 0,
        progress: Math.round(p.actualProgress),
        riskLevel: p.riskLevel,
      })),
    [filtered]
  );

  if (projectsQuery.isLoading) return <Spinner label="Loading dashboard..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Officer Dashboard</h1>
          <p className="text-sm text-primary-500">Portfolio overview and projects requiring attention</p>
        </div>
        <Link to="/officer/projects/new">
          <Button>
            <PlusCircle className="h-4 w-4" /> New Project
          </Button>
        </Link>
      </div>

      {projectsQuery.isSuccess && projects.length === 0 && (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-100 text-surface-400">
              <Inbox className="h-7 w-7" />
            </div>
            <p className="text-lg font-semibold text-primary-800">No projects imported yet.</p>
            <p className="max-w-sm text-sm text-surface-500">
              Import a project baseline CSV or create a project manually to start monitoring implementation.
            </p>
            <div className="flex gap-2 pt-2">
              <Link to="/officer/projects/import">
                <Button variant="secondary">
                  <Upload className="h-4 w-4" /> Import CSV
                </Button>
              </Link>
              <Link to="/officer/projects/new">
                <Button variant="outline">
                  <PlusCircle className="h-4 w-4" /> New Project
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      {projects.length > 0 && (
      <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Projects" value={summaryQuery.data?.total ?? 0} icon={FolderKanban} accent="primary" />
        <StatCard label="Critical" value={summaryQuery.data?.critical ?? 0} icon={ShieldAlert} accent="critical" />
        <StatCard label="High Risk" value={summaryQuery.data?.high ?? 0} icon={AlertTriangle} accent="high" />
        <StatCard label="Medium" value={summaryQuery.data?.medium ?? 0} icon={Gauge} accent="medium" />
        <StatCard label="Low" value={summaryQuery.data?.low ?? 0} icon={TrendingDown} accent="low" />
        <StatCard label="Open Investigations" value={summaryQuery.data?.openInvestigations ?? 0} icon={ShieldAlert} accent="neutral" />
      </div>

      <Card>
        <CardHeader
          title="Filters"
          action={
            <div className="flex flex-wrap gap-2">
              <Select className="w-40" value={district} onChange={(e) => setDistrict(e.target.value)}>
                <option value="">All Districts</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
              <Select className="w-40" value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
                <option value="">All Risk Levels</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </Select>
              <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="PLANNED">Planned</option>
                <option value="ACTIVE">Active</option>
                <option value="DELAYED">Delayed</option>
                <option value="COMPLETED">Completed</option>
                <option value="SUSPENDED">Suspended</option>
              </Select>
            </div>
          }
        />
      </Card>

      <Card>
        <CardHeader title="My Projects" subtitle="Every project you've created — flagged (HIGH/CRITICAL risk or priority) ones sorted to the top" />
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-primary-50 text-left text-xs uppercase tracking-wide text-primary-500">
              <tr>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Contractor</th>
                <th className="px-4 py-2">Sanctioned</th>
                <th className="px-4 py-2">Spent</th>
                <th className="px-4 py-2">Progress</th>
                <th className="px-4 py-2">Risk</th>
                <th className="px-4 py-2">Priority</th>
                <th className="px-4 py-2">Updated</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {displayedProjects.map((p) => (
                <ProjectRow key={p._id} project={p} />
              ))}
              {displayedProjects.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-primary-400">
                    No projects match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Risk Distribution" />
          <CardBody style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDistribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {riskDistribution.map((entry) => (
                    <Cell key={entry.name} fill={RISK_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Project Status" />
          <CardBody style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Expenditure % vs Progress %" subtitle="Points above the diagonal are spending faster than they progress" />
          <CardBody style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" dataKey="progress" name="Progress %" unit="%" domain={[0, 100]} />
                <YAxis type="number" dataKey="expenditurePercent" name="Expenditure %" unit="%" domain={[0, 120]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value: number) => `${value}%`} />
                <Scatter data={expenditureVsProgress} fill="#DC2626">
                  {expenditureVsProgress.map((entry, i) => (
                    <Cell key={i} fill={RISK_COLORS[entry.riskLevel] ?? "#2563EB"} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>
      </>
      )}
    </div>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const contractor = typeof project.contractorId === "object" ? project.contractorId?.name : "Unassigned";
  return (
    <tr className="border-t border-primary-100 hover:bg-primary-50/50">
      <td className="px-4 py-2">
        <p className="font-medium text-primary-900">{project.name}</p>
        <p className="text-xs text-primary-400">{project.projectCode}</p>
      </td>
      <td className="px-4 py-2 text-primary-600">{project.district}</td>
      <td className="px-4 py-2 text-primary-600">{contractor}</td>
      <td className="px-4 py-2 text-primary-600">₹{project.sanctionedAmount.toLocaleString("en-IN")}</td>
      <td className="px-4 py-2 text-primary-600">₹{project.spentAmount.toLocaleString("en-IN")}</td>
      <td className="px-4 py-2 text-primary-600">{project.actualProgress.toFixed(0)}%</td>
      <td className="px-4 py-2">
        <RiskBadge level={project.riskLevel} />
      </td>
      <td className="px-4 py-2">
        <RiskBadge level={project.priority} />
      </td>
      <td className="px-4 py-2 text-xs text-primary-400">{new Date(project.updatedAt).toLocaleDateString()}</td>
      <td className="px-4 py-2">
        <Link to={`/officer/projects/${project._id}`}>
          <Button size="sm" variant="outline">
            Investigate
          </Button>
        </Link>
      </td>
    </tr>
  );
}
