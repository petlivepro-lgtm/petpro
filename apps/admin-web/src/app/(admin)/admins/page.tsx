import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/service";
import { dateBR, dateTimeBR, relative } from "@/lib/format";
import {
  assignableRoles,
  hasRole,
  isAdminRole,
  PERMISSION_MATRIX,
  ROLE_LABEL,
  STATUS_LABEL,
  type AdminRole,
  type AdminStatus,
} from "@/lib/roles";
import { PageBody, PageHeader } from "@/components/page-header";
import { Panel, Pill, TableBox, Td, Th, type PillTone } from "@/components/ui";
import { AdminRowActions, CancelInviteButton, InviteButton } from "./admin-controls";

export const metadata: Metadata = { title: "Administradores" };

const STATUS_TONE: Record<AdminStatus, PillTone> = { active: "green", invited: "petrol", suspended: "red" };

type AdminRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  status: AdminStatus;
  activated_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
};

export default async function AdminsPage() {
  const me = await requireAdminPage({ minRole: "admin" });
  const svc = serviceClient();
  const since = new Date(Date.now() - 12 * 3600_000).toISOString();

  const [{ data: admins }, { data: sessions }, { data: invites }] = await Promise.all([
    svc
      .from("platform_admin")
      .select("user_id, email, display_name, role, status, activated_at, suspended_at, suspension_reason")
      .order("created_at"),
    svc
      .from("platform_admin_session")
      .select("user_id, last_seen_at, revoked_at, created_at")
      .gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString()),
    svc
      .from("platform_admin_invite")
      .select("id, email, role, expires_at, claimed_at, created_at")
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const rows = (admins ?? []) as AdminRow[];
  const sess = (sessions ?? []) as { user_id: string; last_seen_at: string; revoked_at: string | null; created_at: string }[];
  const mfa = await Promise.all(
    rows.map(async (a) => {
      const { data } = await svc.auth.admin.mfa.listFactors({ userId: a.user_id });
      return (data?.factors ?? []).some((f) => f.status === "verified");
    }),
  );

  const canInvite = assignableRoles(me.role);
  const isSuper = hasRole(me.role, "superadmin");

  return (
    <>
      <PageHeader
        title="Administradores"
        description="Quem entra aqui e o que cada um pode fazer."
        actions={canInvite.length ? <InviteButton roles={canInvite} /> : null}
      />
      <PageBody>
        <Panel padded={false}>
          <TableBox minWidth={900}>
            <thead>
              <tr>
                <Th>Pessoa</Th>
                <Th>Papel</Th>
                <Th>Situação</Th>
                <Th>2FA</Th>
                <Th>Último acesso</Th>
                <Th align="right">Sessões abertas</Th>
                <Th>
                  <span className="sr-only">Ações</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => {
                const mine = sess.filter((s) => s.user_id === a.user_id);
                const open = mine.filter((s) => !s.revoked_at && s.created_at >= since).length;
                const last = mine.reduce<string | null>((acc, s) => (!acc || s.last_seen_at > acc ? s.last_seen_at : acc), null);
                const role = isAdminRole(a.role) ? (a.role as AdminRole) : null;
                return (
                  <tr key={a.user_id}>
                    <Td>
                      <span className="block font-semibold">
                        {a.display_name ?? a.email}
                        {a.user_id === me.userId && <span className="ml-1.5 text-xs font-normal text-gray-neutral">(você)</span>}
                      </span>
                      <span className="block text-xs text-gray-neutral">{a.email}</span>
                    </Td>
                    <Td>{role ? ROLE_LABEL[role] : a.role}</Td>
                    <Td>
                      <Pill tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Pill>
                      {a.status === "suspended" && a.suspension_reason && (
                        <span className="mt-1 block max-w-[220px] text-xs text-gray-neutral">{a.suspension_reason}</span>
                      )}
                    </Td>
                    <Td className={mfa[i] ? "text-[#22603F]" : "text-gray-neutral"}>{mfa[i] ? "Ligado" : "Ainda não"}</Td>
                    <Td className="text-gray-neutral">{last ? relative(last) : a.activated_at ? `ativado em ${dateBR(a.activated_at)}` : "—"}</Td>
                    <Td align="right">{open}</Td>
                    <Td align="right">
                      <AdminRowActions userId={a.user_id} status={a.status} isSelf={a.user_id === me.userId} canManage={isSuper} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableBox>
        </Panel>

        {(invites ?? []).length > 0 && (
          <Panel title="Convites em aberto" padded={false}>
            <TableBox minWidth={640}>
              <thead>
                <tr>
                  <Th>E-mail</Th>
                  <Th>Papel</Th>
                  <Th>Enviado</Th>
                  <Th>Vence</Th>
                  <Th>
                    <span className="sr-only">Ações</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {(invites as { id: string; email: string; role: string; expires_at: string; claimed_at: string | null; created_at: string }[]).map((inv) => (
                  <tr key={inv.id}>
                    <Td>
                      {inv.email}
                      {inv.claimed_at && <span className="block text-xs text-petrol">link aberto, ativação em andamento</span>}
                    </Td>
                    <Td>{isAdminRole(inv.role) ? ROLE_LABEL[inv.role] : inv.role}</Td>
                    <Td className="text-gray-neutral">{dateTimeBR(inv.created_at)}</Td>
                    <Td className="text-gray-neutral">{dateTimeBR(inv.expires_at)}</Td>
                    <Td align="right">
                      <CancelInviteButton inviteId={inv.id} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableBox>
          </Panel>
        )}

        <Panel title="O que cada papel alcança" description="Ninguém atribui um papel igual ou acima do seu. O último superadmin não pode ser removido." padded={false}>
          <TableBox minWidth={640}>
            <thead>
              <tr>
                <Th>Ação</Th>
                <Th align="center">Suporte</Th>
                <Th align="center">Admin</Th>
                <Th align="center">Superadmin</Th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MATRIX.map((entry) => (
                <tr key={entry.action}>
                  <Td>{entry.action}</Td>
                  {(["suporte", "admin", "superadmin"] as AdminRole[]).map((r) => (
                    <Td key={r} align="center">
                      {hasRole(r, entry.minimumRole) ? (
                        <Check className="mx-auto h-4 w-4 text-[#22603F]" strokeWidth={2.5} aria-label="sim" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-graphite/30" aria-label="não" />
                      )}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </TableBox>
        </Panel>
      </PageBody>
    </>
  );
}
