"use client";

import { useState } from "react";
import { Tabs } from "@mylivepet/ui";

export function PetTabs({
  historico,
  agenda,
  vendas,
}: {
  historico: React.ReactNode;
  agenda: React.ReactNode;
  vendas: React.ReactNode;
}) {
  const [active, setActive] = useState("historico");
  const tabs = [
    { id: "historico", label: "Histórico" },
    { id: "agenda", label: "Agenda" },
    { id: "vendas", label: "Vendas" },
  ];

  return (
    <div>
      <Tabs tabs={tabs} active={active} onChange={setActive} className="mb-5" />
      {active === "historico" && historico}
      {active === "agenda" && agenda}
      {active === "vendas" && vendas}
    </div>
  );
}
