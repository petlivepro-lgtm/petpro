import type { Metadata } from "next";
import { KeyRound, ShieldCheck, Users } from "lucide-react";
import { EmptyState, Label, Select } from "@mylivepet/ui";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getTenantOptions, getTutorList } from "@/lib/data";
import { monthYear, num, relative } from "@/lib/format";
import { hasRole } from "@/lib/roles";
import { PageBody, PageHeader } from "@/components/page-header";
import { Chip, Pagination, Panel, TableBox, Td, Th } from "@/components/ui";
import { SearchForm } from "@/components/search-form";
import { ReasonDialog } from "@/components/reason-dialog";
import { RevealCell } from "./reveal-cell";
import { sendTutorResetLink } from "./actions";

export const metadata: Metadata = { title: "Tutores" };

const LIMIT = 25;
const APP_FILTERS = ["all", "app", "never"] as const;

export default async function TutoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; petshop?: string; app?: string; desde?: string; foco?: string }>;
}) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const q = sp.q?.slice(0, 120) ?? "";
  const petshop = z.string().uuid().safeParse(sp.petshop).success ? sp.petshop! : "";
  const app = APP_FILTERS.find((f) => f === sp.app) ?? "all";
  const offset = Math.max(0, Number.parseInt(sp.desde ?? "0", 10) || 0);
  // Escolhido numa sugestão: a linha dessa pessoa fica destacada.
  const focus = z.string().uuid().safeParse(sp.foco).success ? sp.foco : undefined;
  const [list, tenants] = await Promise.all([
    getTutorList({ search: q, tenant: petshop, app, limit: LIMIT, offset }),
    getTenantOptions(),
  ]);
  const canReveal = hasRole(admin.role, "admin");

  const href = (o: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (petshop) s.set("petshop", petshop);
    if (app !== "all") s.set("app", app);
    if (o) s.set("desde", String(o));
    const qs = s.toString();
    return `/tutores${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Tutores" description={`${num(list.total)} encontrados · dados pessoais mascarados`} />
      <PageBody>
        <p className="flex gap-3 rounded-xl bg-petrol/[0.07] px-4 py-3.5 text-sm leading-relaxed text-petrol">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          E-mail, telefone e CPF chegam mascarados do banco.{" "}
          {canReveal
            ? "Para ver um campo inteiro é preciso informar o motivo — fica registrado na auditoria com seu nome."
            : "Seu papel não revela dados pessoais."}
        </p>

        <SearchForm action="/tutores" suggest="tutores" value={q} placeholder="Nome, e-mail ou telefone">
          <div className="min-w-[200px] flex-[1_1_200px]">
            <Label htmlFor="petshop">Petshop</Label>
            <Select id="petshop" name="petshop" defaultValue={petshop}>
              <option value="">Todos os petshops</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[170px] flex-[1_1_170px]">
            <Label htmlFor="app">App do tutor</Label>
            <Select id="app" name="app" defaultValue={app}>
              <option value="all">Todos</option>
              <option value="app">Já entrou no app</option>
              <option value="never">Nunca entrou</option>
            </Select>
          </div>
        </SearchForm>

        <Panel padded={false}>
          {list.rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title="Nenhum tutor encontrado"
                description="Busque pelo nome, pelo e-mail completo ou por parte do telefone (4 dígitos ou mais)."
              />
            </div>
          ) : (
            <>
              <TableBox minWidth={1040}>
                <thead>
                  <tr>
                    <Th>Tutor</Th>
                    <Th>E-mail</Th>
                    <Th>Telefone</Th>
                    <Th>CPF</Th>
                    <Th>Petshops</Th>
                    <Th align="right">Pets</Th>
                    <Th>App</Th>
                    <Th>
                      <span className="sr-only">Ações</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((r) => (
                    <tr
                      key={r.tutor_id}
                      aria-current={r.tutor_id === focus ? "true" : undefined}
                      className={r.tutor_id === focus ? "bg-petrol/[0.06]" : undefined}
                    >
                      <Td>
                        <span className="block font-semibold">{r.full_name}</span>
                        <span className="block text-xs text-gray-neutral">desde {monthYear(r.since)}</span>
                      </Td>
                      <Td>
                        <RevealCell tutorId={r.tutor_id} field="email" masked={r.email} name={r.full_name} canReveal={canReveal} />
                      </Td>
                      <Td>
                        <RevealCell tutorId={r.tutor_id} field="phone" masked={r.phone} name={r.full_name} canReveal={canReveal} />
                      </Td>
                      <Td>
                        <RevealCell tutorId={r.tutor_id} field="cpf" masked={r.cpf} name={r.full_name} canReveal={canReveal} />
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {r.shops.map((s) => (
                            <Chip key={s}>{s}</Chip>
                          ))}
                        </div>
                      </Td>
                      <Td align="right">{num(r.pets)}</Td>
                      <Td className="whitespace-nowrap text-gray-neutral">
                        {r.has_account ? (r.last_sign_in_at ? relative(r.last_sign_in_at) : "nunca entrou") : "sem conta"}
                      </Td>
                      <Td align="right">
                        {canReveal && r.has_account && (
                          <ReasonDialog
                            trigger={<KeyRound className="h-4 w-4" aria-hidden />}
                            triggerLabel={`Reenviar link de senha para ${r.full_name}`}
                            triggerClassName="grid h-9 w-9 place-items-center rounded-lg border border-graphite/15 text-graphite transition-colors hover:bg-surface-muted"
                            title={`Reenviar link de senha para ${r.full_name}`}
                            description="O tutor recebe um e-mail para criar uma senha nova no app. Você não vê nem define a senha."
                            confirmLabel="Enviar link"
                            action={sendTutorResetLink.bind(null, r.tutor_id)}
                          />
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableBox>
              <Pagination total={list.total} limit={LIMIT} offset={offset} hrefFor={href} />
            </>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
