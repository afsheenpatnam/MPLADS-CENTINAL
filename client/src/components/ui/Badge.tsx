import clsx from "clsx";

const RISK_STYLES: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-300",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-300",
  HIGH: "bg-orange-100 text-orange-800 border-orange-300",
  CRITICAL: "bg-red-100 text-red-800 border-red-300",
};

const SEVERITY_STYLES: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-300",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-300",
  HIGH: "bg-orange-100 text-orange-800 border-orange-300",
  CRITICAL: "bg-red-100 text-red-800 border-red-300",
};

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-red-50 text-red-700 border-red-200",
  CLARIFICATION_REQUESTED: "bg-amber-50 text-amber-700 border-amber-200",
  UNDER_REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DISMISSED: "bg-stone-100 text-stone-500 border-stone-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PLANNED: "bg-blue-50 text-blue-700 border-blue-200",
  DELAYED: "bg-orange-50 text-orange-700 border-orange-200",
  COMPLETED: "bg-stone-100 text-stone-600 border-stone-200",
  SUSPENDED: "bg-red-50 text-red-700 border-red-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

export function RiskBadge({ level, className }: { level: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", RISK_STYLES[level] ?? "bg-stone-100 text-stone-700 border-stone-300", className)}>
      {level}
    </span>
  );
}

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", SEVERITY_STYLES[severity] ?? "bg-stone-100 text-stone-700 border-stone-300", className)}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUS_STYLES[status] ?? "bg-stone-100 text-stone-700 border-stone-300", className)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function ClassificationBadge({ classification, className }: { classification: string; className?: string }) {
  const styles: Record<string, string> = {
    ANOMALY: "bg-primary-100 text-primary-800 border-primary-300",
    FRAUD_RISK_INDICATOR: "bg-red-100 text-red-800 border-red-300",
    INEFFICIENCY: "bg-amber-100 text-amber-800 border-amber-300",
  };
  const labels: Record<string, string> = {
    ANOMALY: "Anomaly",
    FRAUD_RISK_INDICATOR: "Fraud Risk Indicator",
    INEFFICIENCY: "Inefficiency",
  };
  return (
    <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", styles[classification] ?? "bg-stone-100 text-stone-700", className)}>
      {labels[classification] ?? classification}
    </span>
  );
}
