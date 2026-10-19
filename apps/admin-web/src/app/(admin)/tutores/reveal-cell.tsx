"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { ReasonDialog } from "@/components/reason-dialog";
import { revealField } from "./actions";

const LABEL = { phone: "telefone", cpf: "CPF", email: "e-mail" } as const;

/**
 * Valor mascarado + "Revelar". O valor inteiro vive só neste estado: some ao
 * recarregar a página, e cada revelação é um registro novo na auditoria.
 */
export function RevealCell({
  tutorId,
  field,
  masked,
  name,
  canReveal,
}: {
  tutorId: string;
  field: keyof typeof LABEL;
  masked: string | null;
  name: string;
  canReveal: boolean;
}) {
  const [value, setValue] = useState<string | null>(null);

  if (!masked) return <span className="text-gray-neutral">—</span>;
  if (value) {
    return (
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold tabular">{value}</span>
        <span className="text-[11px] font-semibold text-[#B5442F]">revelado · registrado</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="tabular">{masked}</span>
      {canReveal && (
        <ReasonDialog
          trigger={<Eye className="h-4 w-4" aria-hidden />}
          triggerLabel={`Revelar ${LABEL[field]}`}
          triggerClassName="grid h-8 w-8 place-items-center rounded-lg text-gray-neutral transition-colors hover:bg-surface-muted hover:text-graphite"
          title={`Revelar ${LABEL[field]} de ${name}`}
          description="Fica registrado na auditoria: você, o horário, o campo e o motivo. O valor volta a ficar mascarado ao sair da página."
          confirmLabel="Revelar e registrar"
          action={(reason) => revealField(tutorId, field, reason)}
          onDone={(v) => setValue(v ?? "(vazio)")}
        />
      )}
    </span>
  );
}
