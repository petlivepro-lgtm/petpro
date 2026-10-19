import { ShieldCheck } from "lucide-react";
import { peekAdmin, SESSION_LIMIT_H } from "@/lib/auth";
import { timeBR } from "@/lib/format";

/** Selo da sessão: 2FA confirmado e até quando a sessão vale. */
async function SessionPill() {
  const admin = await peekAdmin();
  if (!admin) return null;
  const ends = new Date(admin.sessionCreatedAt.getTime() + SESSION_LIMIT_H * 3600_000);
  return (
    <span className="flex min-h-9 items-center gap-2 rounded-full bg-success/10 px-3 text-[13px] font-semibold text-[#22603F]">
      <ShieldCheck className="h-[15px] w-[15px]" aria-hidden />
      2FA verificado · sessão até {timeBR(ends)}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <header className="border-b border-graphite/[0.08] bg-surface px-5 py-5 md:px-8">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3">
        {back}
        <div className="flex flex-wrap items-center gap-4">
          <div className="mr-auto flex min-w-0 flex-col gap-0.5">
            <h1 className="font-heading text-2xl font-extrabold tracking-tight">{title}</h1>
            {description && <p className="text-sm text-gray-neutral">{description}</p>}
          </div>
          {actions}
          <SessionPill />
        </div>
      </div>
    </header>
  );
}

/** Miolo fluido e centralizado: sem faixa vazia em monitor largo. */
export function PageBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-5 px-5 pb-10 pt-6 md:px-8">{children}</div>
  );
}
