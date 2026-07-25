"use client";

import * as React from "react";
import { cn } from "./cn";
import { Input } from "./input";

export interface PasswordInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> {}

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(({ className, disabled, id, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);
  const actionLabel = visible ? "Ocultar senha" : "Mostrar senha";

  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        id={id}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-11", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        onMouseDown={(event) => event.preventDefault()}
        disabled={disabled}
        aria-label={actionLabel}
        aria-pressed={visible}
        aria-controls={id}
        title={actionLabel}
        className={cn(
          "absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg",
          "text-gray-neutral transition-colors hover:bg-surface-muted hover:text-graphite",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M2.1 12a11.5 11.5 0 0 1 19.8 0 11.5 11.5 0 0 1-19.8 0Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="m2 2 20 20" />
      <path d="M6.7 6.7A11.8 11.8 0 0 0 2.1 12a11.5 11.5 0 0 0 16.2 5.3" />
      <path d="M10.7 10.7a2 2 0 0 0 2.6 2.6" />
      <path d="M14.2 5.2A11.4 11.4 0 0 1 21.9 12a11.8 11.8 0 0 1-2 2.9" />
    </svg>
  );
}
