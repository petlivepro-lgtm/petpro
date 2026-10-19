import Link from "next/link";
import type { Metadata } from "next";
import { Video } from "lucide-react";
import { EmptyState } from "@mylivepet/ui";
import { requireAdminPage } from "@/lib/auth";
import { getCameraOverview } from "@/lib/data";
import { num, relative } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/page-header";
import { Kpi, KpiGrid, Panel, Pill, TableBox, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "Câmeras" };

export default async function CamerasPage() {
  await requireAdminPage();
  const rows = await getCameraOverview();
  const withGateway = rows.filter((r) => r.online !== null);
  const online = withGateway.filter((r) => r.online).length;
  const live = rows.reduce((s, r) => s + r.live_now, 0);
  const cameras = rows.reduce((s, r) => s + r.cameras, 0);

  return (
    <>
      <PageHeader title="Câmeras" description="Gateways e câmeras dos petshops. Só status e metadados — sem vídeo." />
      <PageBody>
        <KpiGrid>
          <Kpi label="Gateways online" value={`${num(online)} / ${num(withGateway.length)}`} tone={online < withGateway.length ? "warn" : "muted"} hint={online < withGateway.length ? `${num(withGateway.length - online)} offline` : "todos respondendo"} />
          <Kpi label="Câmeras ativas" value={num(cameras)} />
          <Kpi label="Ao vivo agora" value={num(live)} hint="sessões de atendimento abertas" />
        </KpiGrid>
        <Panel padded={false}>
          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<Video className="h-6 w-6" />} title="Nenhum petshop com câmera ainda" />
            </div>
          ) : (
            <TableBox minWidth={760}>
              <thead>
                <tr>
                  <Th>Petshop</Th>
                  <Th>Gateway</Th>
                  <Th>Último sinal</Th>
                  <Th align="right">Câmeras</Th>
                  <Th align="right">Ao vivo</Th>
                  <Th align="right">Sessões 7d</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <Link href={`/petshops/${r.id}`} className="font-semibold text-graphite hover:underline">
                        {r.name}
                      </Link>
                    </Td>
                    <Td>
                      {r.online === null ? <Pill>Sem gateway</Pill> : r.online ? <Pill tone="green">Online</Pill> : <Pill tone="red">Offline</Pill>}
                    </Td>
                    <Td className="text-gray-neutral">{r.last_seen_at ? relative(r.last_seen_at) : "—"}</Td>
                    <Td align="right">{num(r.cameras)}</Td>
                    <Td align="right">{num(r.live_now)}</Td>
                    <Td align="right">{num(r.sessions_7d)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableBox>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
