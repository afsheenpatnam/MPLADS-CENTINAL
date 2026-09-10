import clsx from "clsx";
import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="mb-1 block text-sm font-medium text-primary-700" {...props} />;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={clsx(
      "w-full rounded-lg border border-primary-200 bg-surface-50 px-3 py-2 text-sm text-primary-900 placeholder:text-primary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={clsx(
      "w-full rounded-lg border border-primary-200 bg-surface-50 px-3 py-2 text-sm text-primary-900 placeholder:text-primary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={clsx(
      "w-full rounded-lg border border-primary-200 bg-surface-50 px-3 py-2 text-sm text-primary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
