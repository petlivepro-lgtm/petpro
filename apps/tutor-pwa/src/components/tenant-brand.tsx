import { Building2 } from "lucide-react";
import { cn } from "@mylivepet/ui";

type TenantBrandProps = {
  name: string;
  logoUrl: string | null;
  compact?: boolean;
  className?: string;
};

export function TenantBrand({
  name,
  logoUrl,
  compact = false,
  className,
}: TenantBrandProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {logoUrl ? (
        // A URL vem do upload de logo configurado pelo próprio petshop.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`Logo do petshop ${name}`}
          className={cn(
            "shrink-0 rounded-xl border border-graphite/10 bg-surface object-cover",
            compact ? "h-8 w-8" : "h-10 w-10",
          )}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl bg-orange/10 text-orange",
            compact ? "h-8 w-8" : "h-10 w-10",
          )}
        >
          <Building2 className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </span>
      )}
      <p
        className={cn(
          "truncate font-medium text-graphite",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {name}
      </p>
    </div>
  );
}
