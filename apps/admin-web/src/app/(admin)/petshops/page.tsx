import Link from "next/link";
import type { Metadata } from "next";
import { Store } from "lucide-react";
import { EmptyState } from "@mylivepet/ui";
import { requireAdminPage } from "@/lib/auth";
import { getTenantList, type TenantRow } from "@/lib/data";
import { monthYear, num, relative } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/page-header";
import { Chip, FilterTabs, Pagination, Panel, Pill, TableBox, Td, Th, type PillTone } from "@/components/ui";
import { SearchForm } from "@/components/search-form";

export const metadata: Metadata = { title: "Petshops" };

const LIMIT = 25;
const FILTERS = ["all", "active", "stalled", "new"] as const;
const STATE: Record<TenantRow["state"], { label: string; tone: PillTone }> = {
  active: { label: "Ativo", tone: "green" },
  stalled: { label: "Parado 14+ dias", tone: "amber" },
  new: { label: "Novo", tone: "petrol" },
};

function gatewayLabel(row: TenantRow) {
  if (!row.cameras && !row.gateway_seen_at) return { text: "—", warn: false };
  const online = row.gateway_seen_at && Date.now() - new Date(row.gateway_seen_at).getTime() < 3 * 60_000;
  return { text: `${row.cameras} · ${online ? "online" : "offline"}`, warn: !online };
}

export default async function PetshopsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string; desde?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = sp.q?.slice(0, 120) ?? "";
  const filter = FILTERS.find((f) => f === sp.filtro) ?? "all";
  const offset = Math.max(0, Number.parseInt(sp.desde ?? "0", 10) || 0);
  const list = await getTenantList({ search: q, filter, limit: LIMIT, offset });

  const href = (params: Record<string, string | number | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, filtro: filter, ...params })) {
      if (v !== undefined && v !== "" && !(k === "filtro" && v === "all") && !(k === "desde" && String(v) === "0")) s.set(k, String(v));
    }
    const qs = s.toString();
    return `/petshops${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Petshops"
        description={`${num(list.counts.all)} cadastrados · ${num(list.counts.active + list.counts.new)} com atividade recente`}
      />
      <PageBody>
        <SearchForm action="/petshops" suggest="petshops" value={q} placeholder="Nome, endereço, dono ou e-mail" hidden={{ filtro: filter === "all" ? undefined : filter }} />
        <FilterTabs
          label="Situação"
          tabs={[
            { key: "all", label: "Todos", count: list.counts.all },
            { key: "active", label: "Ativos", count: list.counts.active },
            { key: "stalled", label: "Parados 14+ dias", count: list.counts.stalled },
            { key: "new", label: "Novos (30 dias)", count: list.counts.new },
          ].map((t) => ({ href: href({ filtro: t.key, desde: undefined }), label: t.label, count: t.count, active: t.key === filter }))}
        />

        <Panel padded={false}>
          {list.rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Store className="h-6 w-6" />}
                title="Nenhum petshop encontrado"
                description={q ? "Tente outro nome ou limpe a busca." : "Os petshops aparecem aqui assim que se cadastram em app.petlivepro.com.br."}
              />
            </div>
          ) : (
            <>
              <TableBox minWidth={1000}>
                <thead>
                  <tr>
                    <Th>Petshop</Th>
                    <Th>Dono</Th>
                    <Th>Último sinal</Th>
                    <Th align="right">Tutores</Th>
                    <Th align="right">Atend. 30d</Th>
                    <Th>Câmeras</Th>
                    <Th>Módulos</Th>
                    <Th>Situação</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((r) => {
                    const gw = gatewayLabel(r);
                    const modules = [r.uses_clubinho && "Clubinho", r.uses_delivery && "Leva-e-traz", r.uses_store && "Loja"].filter(Boolean) as string[];
                    return (
                      <tr key={r.id} className="transition-colors hover:bg-surface-muted/50">
                        <Td>
                          <Link href={`/petshops/${r.id}`} className="flex flex-col gap-0.5 text-graphite">
                            <span className="font-semibold hover:underline">{r.name}</span>
                            <span className="text-xs text-gray-neutral">
                              {r.address ? `${r.address} · ` : ""}desde {monthYear(r.created_at)}
                            </span>
                          </Link>
                        </Td>
                        <Td>
                          <span className="block">{r.owner_name ?? "—"}</span>
                          <span className="block text-xs text-gray-neutral">{r.owner_email ?? ""}</span>
                        </Td>
                        <Td className="whitespace-nowrap">{relative(r.last_activity)}</Td>
                        <Td align="right">{num(r.tutors)}</Td>
                        <Td align="right">{num(r.appointments_30d)}</Td>
                        <Td className={gw.warn ? "whitespace-nowrap text-[#B5442F]" : "whitespace-nowrap"}>{gw.text}</Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {modules.length ? modules.map((m) => <Chip key={m}>{m}</Chip>) : <span className="text-gray-neutral">—</span>}
                          </div>
                        </Td>
                        <Td>
                          <Pill tone={STATE[r.state].tone}>{STATE[r.state].label}</Pill>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableBox>
              <Pagination total={list.total} limit={LIMIT} offset={offset} hrefFor={(o) => href({ desde: o })} />
            </>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
