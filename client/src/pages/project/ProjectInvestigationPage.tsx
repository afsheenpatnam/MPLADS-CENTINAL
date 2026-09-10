import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { detectionApi, projectApi } from "../../api/endpoints";
import { Button } from "../../components/ui/Button";
import { RiskBadge, StatusBadge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { Tabs } from "../../components/ui/Tabs";
import { useAuth } from "../../hooks/useAuth";
import { OverviewTab } from "./tabs/OverviewTab";
import { DataImportTab } from "./tabs/DataImportTab";
import { SanctionTab } from "./tabs/SanctionTab";
import { FinancialsTab } from "./tabs/FinancialsTab";
import { ProgressTab } from "./tabs/ProgressTab";
import { SiteVisitsTab } from "./tabs/SiteVisitsTab";
import { EvidenceTab } from "./tabs/EvidenceTab";
import { AnomaliesTab } from "./tabs/AnomaliesTab";
import { MLAnalysisTab } from "./tabs/MLAnalysisTab";
import { RiskTab } from "./tabs/RiskTab";
import { AIReportTab } from "./tabs/AIReportTab";
import { InvestigationTab } from "./tabs/InvestigationTab";
import { AuditTab } from "./tabs/AuditTab";

const COMMON_TABS = [
  { id: "overview", label: "Overview" },
  { id: "import", label: "Data Import" },
  { id: "sanction", label: "Sanction" },
  { id: "financials", label: "Financials" },
  { id: "progress", label: "Progress" },
  { id: "visits", label: "Site Visits" },
  { id: "evidence", label: "Evidence" },
  { id: "investigation", label: "Investigation" },
];

const OFFICER_ONLY_TABS = [
  { id: "anomalies", label: "Anomalies & Fraud Risk" },
  { id: "ml", label: "ML Analysis" },
  { id: "risk", label: "Risk & Priority" },
  { id: "ai", label: "AI Report" },
  { id: "audit", label: "Audit Trail" },
];

export function ProjectInvestigationPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const queryClient = useQueryClient();
  const [analyzing, setAnalyzing] = useState(false);

  const projectQuery = useQuery({ queryKey: ["project", id], queryFn: () => projectApi.get(id!), enabled: !!id });

  if (projectQuery.isLoading) return <Spinner label="Loading project..." />;
  if (!projectQuery.data) return <p className="text-primary-500">Project not found.</p>;

  const project = projectQuery.data;
  const isOfficer = user?.role === "OFFICER";
  const backHref = user?.role === "CONTRACTOR" ? "/contractor" : "/officer";
  const visibleTabs = isOfficer ? [...COMMON_TABS, ...OFFICER_ONLY_TABS] : COMMON_TABS;

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      await detectionApi.analyze(project._id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", id] }),
        queryClient.invalidateQueries({ queryKey: ["findings", id] }),
        queryClient.invalidateQueries({ queryKey: ["risk", id] }),
      ]);
      setTab("anomalies");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link to={backHref} className="inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-primary-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-primary-900">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-sm text-primary-500">
            {project.projectCode} · {project.location}, {project.district}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isOfficer && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-primary-400">Risk / Priority</p>
              <div className="mt-1 flex gap-1.5">
                <RiskBadge level={project.riskLevel} />
                <RiskBadge level={project.priority} />
              </div>
            </div>
          )}
          {user?.role === "OFFICER" && (
            <Button onClick={runAnalysis} disabled={analyzing}>
              {analyzing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Run Detection
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-primary-200 bg-white shadow-sm">
        <Tabs tabs={visibleTabs} active={tab} onChange={setTab} />
        <div className="p-5">
          {tab === "overview" && <OverviewTab project={project} />}
          {tab === "import" && <DataImportTab project={project} />}
          {tab === "sanction" && <SanctionTab project={project} />}
          {tab === "financials" && <FinancialsTab project={project} />}
          {tab === "progress" && <ProgressTab project={project} />}
          {tab === "visits" && <SiteVisitsTab project={project} />}
          {tab === "evidence" && <EvidenceTab project={project} />}
          {tab === "investigation" && <InvestigationTab project={project} />}
          {isOfficer && tab === "anomalies" && <AnomaliesTab project={project} />}
          {isOfficer && tab === "ml" && <MLAnalysisTab project={project} />}
          {isOfficer && tab === "risk" && <RiskTab project={project} />}
          {isOfficer && tab === "ai" && <AIReportTab project={project} />}
          {isOfficer && tab === "audit" && <AuditTab project={project} />}
        </div>
      </div>
    </div>
  );
}
