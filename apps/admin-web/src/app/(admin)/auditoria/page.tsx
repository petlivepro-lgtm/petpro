import Link from "next/link";
import type { Metadata } from "next";
import { Button, Label, Select } from "@mylivepet/ui";
import { requireAdminPage } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/service";
import { dateTimeBR } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/page-header";
import { Panel, Pill, TableBox, Td, Th, type PillTone } from "@/components/ui";

export const metadata: Metadata = { title: "Auditoria" };

const LIMIT = 50;

/** Rótulo legível de cada ação registrada. Ação nova sem rótulo aparece crua. */
const ACTIONS: Record<string, { label: string; tone: PillTone }> = {
  "admin.login": { label: "Entrou", tone: "gray" },
  "admin.logout": { label: "Saiu", tone: "gray" },
  "admin.mfa_verified": { label: "Verificou 2FA", tone: "gray" },
  "admin.mfa_enroll_started": { label: "Gerou QR do 2FA", tone: "gray" },
  "admin.step_up": { label: "Reconfirmou 2FA", tone: "gray" },
  "admin.invite_claimed": { label: "Abriu convite", tone: "petrol" },
  "admin.password_set": { label: "Criou senha", tone: "petrol" },
  "admin.activated": { label: "Ativou acesso", tone: "petrol" },
  "admin.invited": { label: "Convidou admin", tone: "petrol" },
  "admin.invite_cancelled": { label: "Cancelou convite", tone: "petrol" },
  "admin.suspended": { label: "Suspendeu admin", tone: "red" },
  "admin.reactivated": { label: "Reativou admin", tone: "petrol" },
  "admin.sessions_revoked": { label: "Revogou sessões", tone: "amber" },
  "tutor.revealed_phone": { label: "Revelou telefone", tone: "red" },
  "tutor.revealed_cpf": { label: "Revelou CPF", tone: "red" },
  "tutor.revealed_email": { label: "Revelou e-mail", tone: "red" },
  "tutor.reset_link": { label: "Link de senha (tutor)", tone: "amber" },
  "tenant.owner_reset_link": { label: "Link de senha (dono)", tone: "amber" },
  "tenant.note_added": { label: "Nota interna", tone: "gray" },
  "identity.lookup": { label: "Consultou e-mail", tone: "amber" },
  "support.replied": { label: "Respondeu chamado", tone: "petrol" },
  "support.internal_note": { label: "Nota no chamado", tone: "gray" },
  "support.updated": { label: "Atualizou chamado", tone: "gray" },
  "support.attachment_opened": { label: "Abriu anexo", tone: "amber" },
};

const GROUPS: Record<string, string[]> = {
  acessos: ["admin.login", "admin.logout", "admin.mfa_verified", "admin.step_up"],
  dados: ["tutor.revealed_phone", "tutor.revealed_cpf", "tutor.revealed_email", "identity.lookup", "support.attachment_opened"],
  governanca: ["admin.invited", "admin.invite_cancelled", "admin.suspended", "admin.reactivated", "admin.sessions_revoked", "admin.activated"],
  senhas: ["tutor.reset_link", "tenant.owner_reset_link"],
};

type AuditRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  tenant_id: string | null;
  reason: string | null;
  ip_hash: string | null;
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string; grupo?: string; antes?: string }>;
}) {
  await requireAdminPage({ minRole: "admin" });
  const sp = await searchParams;
  const svc = serviceClient();
  const group = sp.grupo && GROUPS[sp.grupo] ? sp.grupo : "";
  const before = sp.antes && !Number.isNaN(Date.parse(sp.antes)) ? sp.antes : undefined;

  const { data: adminList } = await svc.from("platform_admin").select("email").order("email");
  const emails = ((adminList ?? []) as { email: string }[]).map((a) => a.email);
  const actor = sp.admin && emails.includes(sp.admin) ? sp.admin : "";

  let q = svc
    .from("platform_admin_audit")
    .select("id, created_at, actor_email, action, resource_type, resource_id, tenant_id, reason, ip_hash")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (actor) q = q.eq("actor_email", actor);
  if (group) q = q.in("action", GROUPS[group]!);
  if (before) q = q.lt("created_at", before);
  const { data } = await q;
  const rows = (data ?? []) as AuditRow[];

  const tenantIds = [...new Set(rows.map((r) => r.tenant_id).filter(Boolean))] as string[];
  const { data: tenants } = tenantIds.length
    ? await svc.from("tenant").select("id, name").in("id", tenantIds)
    : { data: [] };
  const tenantName = new Map(((tenants ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]));
  const last = rows.at(-1);

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Tudo o que os administradores fizeram. O registro não pode ser editado nem apagado — nem pelo banco."
      />
      <PageBody>
        <form action="/auditoria" method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-[1_1_220px]">
            <Label htmlFor="admin">Administrador</Label>
            <Select id="admin" name="admin" defaultValue={actor}>
              <option value="">Todos</option>
              {emails.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[220px] flex-[1_1_220px]">
            <Label htmlFor="grupo">Tipo de ação</Label>
            <Select id="grupo" name="grupo" defaultValue={group}>
              <option value="">Todas</option>
              <option value="acessos">Acessos (login, 2FA)</option>
              <option value="dados">Dados pessoais</option>
              <option value="governanca">Gestão de administradores</option>
              <option value="senhas">Links de senha enviados</option>
            </Select>
          </div>
          <Button type="submit" variant="secondary" className="h-11">
            Filtrar
          </Button>
        </form>

        <Panel padded={false}>
          <TableBox minWidth={980}>
            <thead>
              <tr>
                <Th>Quando</Th>
                <Th>Quem</Th>
                <Th>Ação</Th>
                <Th>Sobre</Th>
                <Th>Motivo</Th>
                <Th>Origem</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const a = ACTIONS[r.action] ?? { label: r.action, tone: "gray" as PillTone };
                const about = r.tenant_id ? (
                  <Link href={`/petshops/${r.tenant_id}`} className="text-petrol hover:underline">
                    {tenantName.get(r.tenant_id) ?? "petshop"}
                  </Link>
                ) : (
                  `${r.resource_type}${r.resource_id && r.resource_type === "email" ? ` ${r.resource_id}` : ""}`
                );
                return (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap text-gray-neutral tabular">{dateTimeBR(r.created_at)}</Td>
                    <Td className="whitespace-nowrap font-semibold">{r.actor_email ?? "—"}</Td>
                    <Td>
                      <Pill tone={a.tone}>{a.label}</Pill>
                    </Td>
                    <Td>{about}</Td>
                    <Td className="max-w-[320px] text-graphite/80">{r.reason ?? "—"}</Td>
                    <Td className="font-mono text-xs text-gray-neutral">
                      {r.ip_hash ? `${r.ip_hash.slice(0, 4)}…${r.ip_hash.slice(-3)}` : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableBox>
          <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 text-[13px] text-gray-neutral">
            <span className="mr-auto">IP guardado só como hash — dá para comparar acessos sem expor o endereço.</span>
            {rows.length === LIMIT && last && (
              <Link
                href={`/auditoria?${new URLSearchParams({ ...(actor ? { admin: actor } : {}), ...(group ? { grupo: group } : {}), antes: last.created_at }).toString()}`}
                className="inline-flex min-h-[38px] items-center rounded-lg border border-graphite/15 bg-surface px-3.5 text-graphite hover:border-graphite/30"
              >
                Carregar mais antigos
              </Link>
            )}
          </div>
        </Panel>
      </PageBody>
    </>
  );
}
