import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/service";
import { LOCK_WINDOW_MIN } from "@/lib/rate-limit";
import { dateTimeBR, num } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/page-header";
import { Kpi, KpiGrid, Panel, Pill, TableBox, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "Segurança" };

type Attempt = { kind: string; email_hash: string | null; ip_hash: string | null; success: boolean; created_at: string };
type SessionRow = { user_id: string; created_at: string; last_seen_at: string; ip_hash: string | null; user_agent: string | null };

function shortHash(h: string | null) {
  return h ? `${h.slice(0, 4)}…${h.slice(-3)}` : "—";
}

function browser(ua: string | null) {
  if (!ua) return "—";
  const name = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Outro";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${name} · ${os}` : name;
}

export default async function SegurancaPage() {
  await requireAdminPage({ minRole: "admin" });
  const svc = serviceClient();
  const day = new Date(Date.now() - 86400_000).toISOString();
  const lockSince = new Date(Date.now() - LOCK_WINDOW_MIN * 60_000).toISOString();

  const [{ data: attempts }, { data: sessions }, { data: admins }] = await Promise.all([
    svc
      .from("platform_admin_login_attempt")
      .select("kind, email_hash, ip_hash, success, created_at")
      .gte("created_at", day)
      .order("created_at", { ascending: false })
      .limit(500),
    svc
      .from("platform_admin_session")
      .select("user_id, created_at, last_seen_at, ip_hash, user_agent")
      .is("revoked_at", null)
      .gte("created_at", new Date(Date.now() - 12 * 3600_000).toISOString())
      .order("last_seen_at", { ascending: false }),
    svc.from("platform_admin").select("user_id, email"),
  ]);

  const list = (attempts ?? []) as Attempt[];
  const failed = list.filter((a) => !a.success);
  const recentFailed = failed.filter((a) => a.created_at >= lockSince);
  const lockedIdentities = new Set(
    [...recentFailed.reduce((m, a) => (a.email_hash ? m.set(a.email_hash, (m.get(a.email_hash) ?? 0) + 1) : m), new Map<string, number>())]
      .filter(([, n]) => n >= 5)
      .map(([h]) => h),
  );
  const email = new Map(((admins ?? []) as { user_id: string; email: string }[]).map((a) => [a.user_id, a.email]));
  const open = (sessions ?? []) as SessionRow[];

  return (
    <>
      <PageHeader title="Segurança" description="Tentativas de acesso, bloqueios e sessões abertas do admin." />
      <PageBody>
        <KpiGrid>
          <Kpi label="Falhas nas últimas 24 h" value={num(failed.length)} tone={failed.length > 10 ? "warn" : "muted"} hint="senha e código 2FA" />
          <Kpi label="Bloqueios ativos" value={num(lockedIdentities.size)} tone={lockedIdentities.size ? "warn" : "muted"} hint={`janela de ${LOCK_WINDOW_MIN} min`} />
          <Kpi label="Sessões abertas" value={num(open.length)} hint="12 h no máximo, 30 min parada" />
        </KpiGrid>

        <Panel title="Sessões abertas" padded={false}>
          <TableBox minWidth={720}>
            <thead>
              <tr>
                <Th>Administrador</Th>
                <Th>Navegador</Th>
                <Th>Origem</Th>
                <Th>Começou</Th>
                <Th>Último uso</Th>
              </tr>
            </thead>
            <tbody>
              {open.map((s, i) => (
                <tr key={`${s.user_id}-${i}`}>
                  <Td className="font-semibold">{email.get(s.user_id) ?? "—"}</Td>
                  <Td>{browser(s.user_agent)}</Td>
                  <Td className="font-mono text-xs text-gray-neutral">{shortHash(s.ip_hash)}</Td>
                  <Td className="text-gray-neutral">{dateTimeBR(s.created_at)}</Td>
                  <Td className="text-gray-neutral">{dateTimeBR(s.last_seen_at)}</Td>
                </tr>
              ))}
            </tbody>
          </TableBox>
        </Panel>

        <Panel title="Tentativas recentes" description="Últimas 24 horas. E-mail e IP aparecem só como hash." padded={false}>
          <TableBox minWidth={720}>
            <thead>
              <tr>
                <Th>Quando</Th>
                <Th>Tipo</Th>
                <Th>Resultado</Th>
                <Th>Identidade</Th>
                <Th>Origem</Th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 100).map((a, i) => (
                <tr key={`${a.created_at}-${i}`}>
                  <Td className="whitespace-nowrap text-gray-neutral tabular">{dateTimeBR(a.created_at)}</Td>
                  <Td>{a.kind === "mfa" ? "Código 2FA" : "Senha"}</Td>
                  <Td>{a.success ? <Pill tone="green">Certo</Pill> : <Pill tone="red">Errado</Pill>}</Td>
                  <Td className="font-mono text-xs text-gray-neutral">
                    {shortHash(a.email_hash)}
                    {a.email_hash && lockedIdentities.has(a.email_hash) && <Pill tone="amber">bloqueado</Pill>}
                  </Td>
                  <Td className="font-mono text-xs text-gray-neutral">{shortHash(a.ip_hash)}</Td>
                </tr>
              ))}
            </tbody>
          </TableBox>
        </Panel>
      </PageBody>
    </>
  );
}
