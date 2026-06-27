import * as React from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  // laranja como CTA/destaque (uso pontual, conforme branding)
  primary: "bg-orange text-white hover:bg-orange/90 focus-visible:ring-orange",
  secondary:
    "bg-surface-muted text-graphite hover:bg-gray-soft border border-graphite/10 focus-visible:ring-graphite",
  ghost: "bg-transparent text-graphite hover:bg-surface-muted focus-visible:ring-graphite",
  danger: "bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
