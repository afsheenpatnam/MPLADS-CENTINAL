import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "primary" | "critical" | "high" | "medium" | "low" | "neutral";
}

const ACCENTS: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "bg-primary-600 text-surface-50",
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-emerald-600 text-white",
  neutral: "bg-primary-100 text-primary-700",
};

export function StatCard({ label, value, icon: Icon, accent = "neutral" }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-primary-200 bg-white p-4 shadow-sm">
      <div className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", ACCENTS[accent])}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-primary-900">{value}</p>
        <p className="text-xs font-medium uppercase tracking-wide text-primary-500">{label}</p>
      </div>
    </div>
  );
}
