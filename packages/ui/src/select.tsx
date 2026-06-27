import * as React from "react";
import { cn } from "./cn";

/** Select nativo (acessível, ótimo no mobile) com box padronizado e seta custom. */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "h-11 w-full appearance-none rounded-xl border border-graphite/15 bg-surface pl-3 pr-10 text-sm text-graphite",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-neutral"
    >
      <path
        d="m6 8 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
));
Select.displayName = "Select";
