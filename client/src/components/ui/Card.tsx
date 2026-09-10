import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("rounded-2xl border border-primary-200 bg-white shadow-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-primary-100 px-5 py-4">
      <div>
        <h3 className="text-base font-semibold text-primary-800">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-primary-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children, style }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("px-5 py-4", className)} style={style}>
      {children}
    </div>
  );
}
