import clsx from "clsx";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

const VARIANT_STYLES: Record<Variant, string> = {
  primary: "bg-primary-600 text-surface-50 hover:bg-primary-700 border border-primary-600",
  secondary: "bg-amber-500 text-white hover:bg-amber-600 border border-amber-500",
  outline: "bg-white text-primary-700 hover:bg-primary-50 border border-primary-300",
  ghost: "bg-transparent text-primary-700 hover:bg-primary-100 border border-transparent",
  danger: "bg-red-600 text-white hover:bg-red-700 border border-red-600",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm",
        VARIANT_STYLES[variant],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
