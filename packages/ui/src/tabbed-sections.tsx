"use client";

import * as React from "react";
import { Tabs } from "./tabs";
import { cn } from "./cn";

export type TabbedSection = {
  id: string;
  label: string;
  content: React.ReactNode;
};

/**
 * Seções em abas para telas longas (configurações), evitando a pilha infinita
 * de cards. As abas rolam na horizontal em telas estreitas.
 *
 * As seções inativas ficam ocultas com `hidden`, não desmontadas: um formulário
 * meio preenchido sobrevive à troca de aba.
 */
export function TabbedSections({
  sections,
  className,
}: {
  sections: TabbedSection[];
  className?: string;
}) {
  const [active, setActive] = React.useState(sections[0]?.id ?? "");

  if (sections.length === 0) return null;

  return (
    <div className={className}>
      <div className="-mx-1 overflow-x-auto px-1">
        <Tabs
          tabs={sections.map(({ id, label }) => ({ id, label }))}
          active={active}
          onChange={setActive}
          className="mb-5 min-w-max"
        />
      </div>
      {sections.map((section) => (
        <div
          key={section.id}
          hidden={section.id !== active}
          className={cn(section.id !== active && "hidden")}
        >
          {section.content}
        </div>
      ))}
    </div>
  );
}
