import { useQuery } from "@tanstack/react-query";
import { investigationApi } from "../../../api/endpoints";
import { Spinner } from "../../../components/ui/Spinner";
import type { Project } from "../../../types";

export function AuditTab({ project }: { project: Project }) {
  const auditQuery = useQuery({ queryKey: ["audit", project._id], queryFn: () => investigationApi.audit(project._id) });

  if (auditQuery.isLoading) return <Spinner label="Loading audit trail..." />;
  const logs = auditQuery.data ?? [];

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const actor = typeof log.userId === "object" ? log.userId : null;
        return (
          <div key={log._id} className="flex items-center justify-between rounded-lg border border-primary-100 px-3 py-2 text-sm">
            <div>
              <p className="font-medium text-primary-900">{log.action.replace(/_/g, " ")}</p>
              <p className="text-xs text-primary-400">
                {actor?.name ?? "System"} ({log.role}) · {log.entity}
              </p>
            </div>
            <span className="text-xs text-primary-400">{new Date(log.timestamp).toLocaleString()}</span>
          </div>
        );
      })}
      {logs.length === 0 && <p className="text-sm text-primary-400">No audit events recorded yet.</p>}
    </div>
  );
}
