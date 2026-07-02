"use client";

import { useRouter } from "next/navigation";
import { Tabs, type TabItem } from "@mylivepet/ui";

const tabs: TabItem[] = [
  { id: "financeiro", label: "Receitas & Despesas" },
  { id: "estoque", label: "Estoque" },
];

/** Abas da página Financeiro sincronizadas com ?tab= (conteúdo renderizado no server). */
export function FinanceiroTabs({ active }: { active: string }) {
  const router = useRouter();
  return (
    <Tabs
      tabs={tabs}
      active={active}
      onChange={(id) => router.replace(`/financeiro?tab=${id}`, { scroll: false })}
      className="mb-6"
    />
  );
}
