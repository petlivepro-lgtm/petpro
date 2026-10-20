import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/service";
import { LOCK_WINDOW_MIN } from "@/lib/rate-limit";
import { dateTimeBR, num } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/page-header";
import { Kpi, KpiGrid, Panel, Pill, TableBox, Td, Th, type PillTone } from "@/components/ui";
import { ReviewButton } from "./review-button";

export const metadata: Metadata = { title: "Segurança" };

type Attempt = { kind: string; email_hash: string | null; ip_hash: string | null; success: boolean; created_at: string };
type SessionRow = { user_id: string; created_at: string; last_seen_at: string; ip_hash: string | null; user_agent: string | null };

type Incident = {
  id: string;
  created_at: string;
  app: "painel" | "tutor";
  surface: string;
  tenant_id: string | null;
  profile_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  file_name: string;
  declared_type: string;
  size_bytes: number;
  reason: "DISGUISED" | "HIDDEN_CODE" | "PDF_ACTIVE_CONTENT" | "IMAGE_BOMB";
  detected: string;
  sha256: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  tenant: { name: string } | null;
};

const INCIDENT_COLUMNS =
  "id, created_at, app, surface, tenant_id, profile_id, actor_name, actor_email, file_name, declared_type, size_bytes, reason, detected, sha256, reviewed_at, reviewed_by, review_note, tenant:tenant_id (name)";

const SURFACE_LABEL: Record<string, string> = {
  pet_photo: "Foto do pet",
  product_photo: "Foto de produto",
  appointment_photo: "Foto do atendimento",
  tenant_logo: "Logo do petshop",
  support_attachment: "Anexo do suporte",
};

const REASON: Record<Incident["reason"], { label: string; tone: PillTone }> = {
  DISGUISED: { label: "Arquivo disfarçado", tone: "red" },
  HIDDEN_CODE: { label: "Código escondido", tone: "red" },
  PDF_ACTIVE_CONTENT: { label: "PDF com conteúdo ativo", tone: "amber" },
  IMAGE_BOMB: { label: "Imagem-bomba", tone: "red" },
};

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

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

  const week = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [{ data: attempts }, { data: sessions }, { data: admins }, { data: openRows }, { data: reviewedRows }, { data: weekRows }] = await Promise.all([
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
    svc.from("platform_admin").select("user_id, email, display_name"),
    svc.from("upload_incident").select(INCIDENT_COLUMNS).is("reviewed_at", null).order("created_at", { ascending: false }).limit(200),
    svc.from("upload_incident").select(INCIDENT_COLUMNS).not("reviewed_at", "is", null).order("reviewed_at", { ascending: false }).limit(20),
    svc.from("upload_incident").select("profile_id").gte("created_at", week).not("profile_id", "is", null),
  ]);
  const openIncidents = (openRows ?? []) as unknown as Incident[];
  const reviewed = (reviewedRows ?? []) as unknown as Incident[];
  // Mesma pessoa tentando de novo é o sinal mais forte: conta por autor na semana.
  const attemptsByActor = ((weekRows ?? []) as { profile_id: string }[]).reduce(
    (m, r) => m.set(r.profile_id, (m.get(r.profile_id) ?? 0) + 1),
    new Map<string, number>(),
  );
  const adminName = new Map(
    ((admins ?? []) as { user_id: string; email: string; display_name: string | null }[]).map((a) => [a.user_id, a.display_name?.trim() || a.email]),
  );

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
      <PageHeader title="Segurança" description="Uploads bloqueados, tentativas de acesso, bloqueios e sessões abertas do admin." />
      <PageBody>
        <KpiGrid>
          <Kpi
            label="Uploads suspeitos para analisar"
            value={num(openIncidents.length)}
            tone={openIncidents.length ? "warn" : "muted"}
            hint="arquivos barrados como tentativa de ataque"
          />
          <Kpi label="Falhas nas últimas 24 h" value={num(failed.length)} tone={failed.length > 10 ? "warn" : "muted"} hint="senha e código 2FA" />
          <Kpi label="Bloqueios ativos" value={num(lockedIdentities.size)} tone={lockedIdentities.size ? "warn" : "muted"} hint={`janela de ${LOCK_WINDOW_MIN} min`} />
          <Kpi label="Sessões abertas" value={num(open.length)} hint="12 h no máximo, 30 min parada" />
        </KpiGrid>

        <Panel
          title="Uploads bloqueados"
          description="Arquivos recusados nos apps por parecerem ataque: programa disfarçado de foto, código ou shell reversa escondidos, PDF com script, imagem feita para travar o servidor. Nenhum foi gravado; aqui fica só o registro."
          padded={false}
        >
          {openIncidents.length === 0 && reviewed.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-neutral">Nenhum upload suspeito até agora.</p>
          ) : (
            <TableBox minWidth={980}>
              <thead>
                <tr>
                  <Th>Quando</Th>
                  <Th>Quem enviou</Th>
                  <Th>Onde</Th>
                  <Th>Arquivo</Th>
                  <Th>O que era</Th>
                  <Th>Situação</Th>
                </tr>
              </thead>
              <tbody>
                {[...openIncidents, ...reviewed].map((i) => {
                  const repeats = i.profile_id ? attemptsByActor.get(i.profile_id) ?? 0 : 0;
                  return (
                    <tr key={i.id} className={i.reviewed_at ? "opacity-70" : undefined}>
                      <Td className="whitespace-nowrap text-gray-neutral tabular">{dateTimeBR(i.created_at)}</Td>
                      <Td>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold">{i.actor_name ?? i.actor_email ?? "Sem sessão"}</span>
                          {i.actor_name && i.actor_email && <span className="text-xs text-gray-neutral">{i.actor_email}</span>}
                          {i.tenant_id && (
                            <Link href={`/petshops/${i.tenant_id}`} className="text-xs font-semibold text-petrol hover:underline">
                              {i.tenant?.name ?? "Petshop"}
                            </Link>
                          )}
                          {repeats > 1 && (
                            <span>
                              <Pill tone="red">{repeats} tentativas em 7 dias</Pill>
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-0.5">
                          <span>{SURFACE_LABEL[i.surface] ?? i.surface}</span>
                          <span className="text-xs text-gray-neutral">{i.app === "painel" ? "Painel do petshop" : "App do tutor"}</span>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex max-w-[220px] flex-col gap-0.5">
                          <span className="break-all font-medium">{i.file_name}</span>
                          <span className="text-xs text-gray-neutral">
                            declarado como {i.declared_type} · {size(i.size_bytes)}
                          </span>
                          <span className="font-mono text-[11px] text-gray-neutral" title={`SHA-256 ${i.sha256}`}>
                            {shortHash(i.sha256)}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex max-w-[280px] flex-col gap-1">
                          <span>
                            <Pill tone={REASON[i.reason].tone}>{REASON[i.reason].label}</Pill>
                          </span>
                          <span className="text-[13px] leading-snug">{i.detected}</span>
                        </div>
                      </Td>
                      <Td>
                        {i.reviewed_at ? (
                          <div className="flex max-w-[220px] flex-col gap-0.5 text-xs text-gray-neutral">
                            <span className="font-semibold text-[#22603F]">Analisado</span>
                            <span>
                              {adminName.get(i.reviewed_by ?? "") ?? "—"} · {dateTimeBR(i.reviewed_at)}
                            </span>
                            {i.review_note && <span className="text-graphite/80">“{i.review_note}”</span>}
                          </div>
                        ) : (
                          <ReviewButton id={i.id} fileName={i.file_name} />
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableBox>
          )}
        </Panel>

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
