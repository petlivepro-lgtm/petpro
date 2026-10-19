import Link from "next/link";
import type { Metadata } from "next";
import { AtSign, Search } from "lucide-react";
import { z } from "zod";
import { Button, EmptyState, Input, Label } from "@mylivepet/ui";
import { requireAdminPage } from "@/lib/auth";
import { lookupIdentity } from "@/lib/data";
import { dateBR, relative } from "@/lib/format";
import { ROLE_LABEL, isAdminRole } from "@/lib/roles";
import { writeAudit } from "@/lib/audit";
import { PageBody, PageHeader } from "@/components/page-header";
import { Panel, Pill } from "@/components/ui";

export const metadata: Metadata = { title: "Busca de identidade" };

const STAFF_ROLE: Record<string, string> = {
  OWNER: "Dono",
  MANAGER: "Gerente",
  ATTENDANT: "Atendente",
  VIEWER: "Leitura",
  COLLABORATOR: "Colaborador",
  DELIVERY: "Entregador",
};

export default async function IdentidadePage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const admin = await requireAdminPage();
  const { email: raw } = await searchParams;
  const parsed = z.string().trim().toLowerCase().email().max(254).safeParse(raw ?? "");
  const email = parsed.success ? parsed.data : null;
  const result = email ? await lookupIdentity(email) : null;
  if (email) {
    // Consultar quem é um e-mail também é acesso a dado pessoal.
    await writeAudit({
      actorId: admin.userId,
      actorEmail: admin.email,
      action: "identity.lookup",
      resourceType: "email",
      resourceId: email,
    });
  }
  const nothing = result && !result.user && !result.memberships.length && !result.tutor_rows.length && !result.admin;

  return (
    <>
      <PageHeader title="Busca de identidade" description="“Quem é este e-mail?” — conta, petshops, fichas de tutor e acesso administrativo." />
      <PageBody>
        <form action="/identidade" method="get" role="search" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-[1_1_320px]">
            <Label htmlFor="email">E-mail completo</Label>
            <Input id="email" name="email" type="email" defaultValue={raw} required maxLength={254} className="focus-visible:ring-petrol" />
          </div>
          <Button type="submit" className="h-11 bg-petrol hover:bg-petrol/90 focus-visible:ring-petrol">
            <Search className="h-4 w-4" aria-hidden /> Consultar
          </Button>
        </form>
        <p className="text-[13px] text-gray-neutral">Cada consulta fica registrada na auditoria.</p>

        {raw && !email && <p className="text-sm font-medium text-[#9A3825]">Digite um e-mail válido.</p>}

        {nothing && (
          <EmptyState icon={<AtSign className="h-6 w-6" />} title="Nenhum registro com este e-mail" description="Não há conta, ficha de tutor nem acesso administrativo ligados a ele." />
        )}

        {result && !nothing && (
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Conta de acesso">
              {result.user ? (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-semibold text-gray-neutral">Criada em</dt>
                    <dd>{dateBR(result.user.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-neutral">Último acesso</dt>
                    <dd>{relative(result.user.last_sign_in_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-neutral">E-mail confirmado</dt>
                    <dd>{result.user.confirmed ? "Sim" : "Não"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-neutral">App autenticador</dt>
                    <dd>{result.user.mfa_factors ? "Ligado" : "Não"}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-gray-neutral">Sem conta de acesso (só ficha cadastrada pelo petshop).</p>
              )}
              {result.admin && (
                <p className="mt-4 flex items-center gap-2 text-sm">
                  Administrador:
                  <Pill tone="petrol">{isAdminRole(result.admin.role) ? ROLE_LABEL[result.admin.role] : result.admin.role}</Pill>
                  <Pill>{result.admin.status}</Pill>
                </p>
              )}
            </Panel>
            <Panel title="Vínculos">
              <div className="flex flex-col gap-4 text-sm">
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold text-gray-neutral">Equipe de petshop</h3>
                  {result.memberships.length ? (
                    <ul className="flex flex-col gap-1.5">
                      {result.memberships.map((m) => (
                        <li key={m.tenant_id}>
                          <Link href={`/petshops/${m.tenant_id}`} className="font-semibold text-petrol hover:underline">
                            {m.tenant_name}
                          </Link>{" "}
                          · {STAFF_ROLE[m.role] ?? m.role} desde {dateBR(m.since)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-neutral">Nenhum.</p>
                  )}
                </div>
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold text-gray-neutral">Fichas de tutor</h3>
                  {result.tutor_rows.length ? (
                    <ul className="flex flex-col gap-1.5">
                      {result.tutor_rows.map((t) => (
                        <li key={t.tutor_id}>
                          <Link href={`/petshops/${t.tenant_id}`} className="font-semibold text-petrol hover:underline">
                            {t.tenant_name}
                          </Link>{" "}
                          · {t.linked_account ? "com conta no app" : "sem conta"} · desde {dateBR(t.since)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-neutral">Nenhuma.</p>
                  )}
                </div>
              </div>
            </Panel>
          </div>
        )}
      </PageBody>
    </>
  );
}
