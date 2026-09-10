import { useQuery } from "@tanstack/react-query";
import { AlertOctagon } from "lucide-react";
import { detectionApi } from "../../../api/endpoints";
import { SeverityBadge } from "../../../components/ui/Badge";
import { useAuth } from "../../../hooks/useAuth";
import type { Project } from "../../../types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-primary-400">{label}</p>
      <p className="text-base font-semibold text-primary-900">{value}</p>
    </div>
  );
}

export function OverviewTab({ project }: { project: Project }) {
  const { user } = useAuth();
  const isOfficer = user?.role === "OFFICER";
  const findingsQuery = useQuery({
    queryKey: ["findings", project._id],
    queryFn: () => detectionApi.findings(project._id),
    enabled: isOfficer,
  });

  const openFindings = (findingsQuery.data ?? []).filter((f) => f.status !== "RESOLVED" && f.status !== "DISMISSED");
  const contractor = typeof project.contractorId === "object" ? project.contractorId : null;
  const officer = typeof project.officerId === "object" ? project.officerId : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Contractor" value={contractor?.name ?? "Unassigned"} />
        <Stat label="Officer" value={officer?.name ?? "-"} />
        <Stat label="Location" value={`${project.location}, ${project.district}`} />
        <Stat label="Sanctioned Amount" value={`₹${project.sanctionedAmount.toLocaleString("en-IN")}`} />
        <Stat label="Released Amount" value={`₹${project.releasedAmount.toLocaleString("en-IN")}`} />
        <Stat label="Spent Amount" value={`₹${project.spentAmount.toLocaleString("en-IN")}`} />
        <Stat label="Expected Progress" value={`${project.expectedProgress.toFixed(0)}%`} />
        <Stat label="Actual Progress" value={`${project.actualProgress.toFixed(0)}%`} />
        <Stat label="Duration" value={`${new Date(project.startDate).toLocaleDateString()} → ${new Date(project.endDate).toLocaleDateString()}`} />
        {isOfficer && <Stat label="Risk Score" value={`${project.riskScore}/100`} />}
      </div>

      {isOfficer && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-orange-800">
            <AlertOctagon className="h-5 w-5" />
            <h3 className="font-semibold">Why This Project Is Flagged</h3>
          </div>
          {openFindings.length === 0 ? (
            <p className="text-sm text-orange-700">No open findings — run detection from the top of this page to analyze the latest data.</p>
          ) : (
            <ul className="space-y-2">
              {openFindings.slice(0, 6).map((f) => (
                <li key={f._id} className="flex items-start justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-primary-900">{f.title}</p>
                    <p className="text-primary-500">{f.description}</p>
                  </div>
                  <SeverityBadge severity={f.severity} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <h3 className="mb-1 text-sm font-semibold text-primary-700">Approved Work</h3>
        <p className="text-sm text-primary-600">{project.approvedWork || "Not yet defined."}</p>
      </div>
    </div>
  );
}
