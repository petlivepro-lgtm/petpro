"use client";

import { useState } from "react";
import { Tabs } from "@mylivepet/ui";

export function PetTabs({
  historico,
  boletim,
  agenda,
  vendas,
}: {
  historico: React.ReactNode;
  boletim: React.ReactNode;
  agenda: React.ReactNode;
  /** Ausente para o colaborador: reserva de produtos é dado comercial. */
  vendas?: React.ReactNode;
}) {
  const [active, setActive] = useState("historico");
  const tabs = [
    { id: "historico", label: "Histórico" },
    { id: "boletim", label: "Boletim" },
    { id: "agenda", label: "Agenda" },
    ...(vendas ? [{ id: "vendas", label: "Vendas" }] : []),
  ];

  return (
    <div>
      <Tabs tabs={tabs} active={active} onChange={setActive} className="mb-5" />
      {active === "historico" && historico}
      {active === "boletim" && boletim}
      {active === "agenda" && agenda}
      {active === "vendas" && vendas}
    </div>
  );
}
