"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { Button, CurrencyInput, Input, Label } from "@mylivepet/ui";
import {
  computeFeeCents,
  formatBRL,
  MAX_INSTALLMENTS,
  PAYMENT_METHOD_LABEL,
  type PaymentFeeRule,
  type PaymentMethod,
} from "@mylivepet/types";
import { savePaymentFeeRules, type FormState } from "./actions";

// Formas à vista que passam pela maquininha. O crédito fica na seção de baixo
// porque é a única que tem faixas de parcelas.
const FLAT_METHODS = [
  "DEBIT_CARD",
  "PIX",
] as const satisfies readonly PaymentMethod[];

type Row = {
  key: string;
  payment_method: PaymentMethod;
  installments_from: number;
  installments_to: number;
  /** String enquanto edita, para não brigar com a vírgula/ponto do teclado. */
  fee_percent: string;
  fee_fixed_cents: number;
  settlement_days: number;
};

const CREDIT_PRESET: [number, number][] = [
  [1, 1],
  [2, 6],
  [7, 12],
];

function newRow(
  method: PaymentMethod,
  from = 1,
  to = 1,
  rule?: PaymentFeeRule,
): Row {
  return {
    key: crypto.randomUUID(),
    payment_method: method,
    installments_from: rule?.installments_from ?? from,
    installments_to: rule?.installments_to ?? to,
    fee_percent: rule ? String(rule.fee_percent) : "0",
    fee_fixed_cents: rule?.fee_fixed_cents ?? 0,
    settlement_days: rule?.settlement_days ?? 0,
  };
}

/** Estado inicial: o que já está salvo, ou uma grade vazia pronta para preencher. */
function initialRows(rules: PaymentFeeRule[]): Row[] {
  const flat = FLAT_METHODS.map((method) =>
    newRow(
      method,
      1,
      1,
      rules.find((rule) => rule.payment_method === method),
    ),
  );

  const credit = rules
    .filter((rule) => rule.payment_method === "CREDIT_CARD")
    .sort((a, b) => a.installments_from - b.installments_from)
    .map((rule) =>
      newRow("CREDIT_CARD", rule.installments_from, rule.installments_to, rule),
    );

  return [
    ...flat,
    ...(credit.length > 0
      ? credit
      : CREDIT_PRESET.map(([from, to]) => newRow("CREDIT_CARD", from, to))),
  ];
}

function toPercent(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRule(row: Row): PaymentFeeRule {
  return {
    payment_method: row.payment_method,
    installments_from: row.installments_from,
    installments_to: row.installments_to,
    fee_percent: toPercent(row.fee_percent),
    fee_fixed_cents: row.fee_fixed_cents,
    settlement_days: row.settlement_days,
  };
}

function rangeLabel(row: Row): string {
  if (row.payment_method !== "CREDIT_CARD") {
    return PAYMENT_METHOD_LABEL[row.payment_method];
  }
  return row.installments_from === row.installments_to
    ? `${row.installments_from}x`
    : `${row.installments_from}x a ${row.installments_to}x`;
}

/**
 * Grade de taxas de uma maquininha. Salva tudo de uma vez (a RPC troca o
 * conjunto numa transação), com uma simulação ao lado para o petshop conferir
 * quanto sobra de cada venda antes de confirmar.
 */
export function FeeRulesForm({
  terminalId,
  rules,
  canManage,
}: {
  terminalId: string;
  rules: PaymentFeeRule[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => initialRows(rules));
  const [sample, setSample] = useState<number | null>(10000);
  const [saved, setSaved] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    savePaymentFeeRules,
    { ok: false },
  );

  useEffect(() => {
    if (!state.ok) return;
    setSaved(true);
    router.refresh();
    const timer = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [state, router]);

  function update(key: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  const creditRows = rows.filter((row) => row.payment_method === "CREDIT_CARD");

  // Duas faixas cobrindo a mesma parcela deixariam a taxa aplicada à sorte do
  // plano de execução — o banco recusa, aqui o aviso aparece antes de salvar.
  const overlapError = useMemo(() => {
    const seen: [number, number][] = [];
    for (const row of creditRows) {
      if (row.installments_to < row.installments_from) {
        return `A faixa "${rangeLabel(row)}" está invertida.`;
      }
      if (
        seen.some(
          ([from, to]) =>
            row.installments_from <= to && row.installments_to >= from,
        )
      ) {
        return `A faixa "${rangeLabel(row)}" se sobrepõe a outra.`;
      }
      seen.push([row.installments_from, row.installments_to]);
    }
    return null;
  }, [creditRows]);

  const config = {
    terminal_id: terminalId,
    rules: rows.map(asRule),
  };

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="config" value={JSON.stringify(config)} />

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-neutral">
          À vista
        </p>
        {rows
          .filter((row) => row.payment_method !== "CREDIT_CARD")
          .map((row) => (
            <RuleFields
              key={row.key}
              row={row}
              sample={sample}
              disabled={!canManage}
              onChange={(patch) => update(row.key, patch)}
            />
          ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-neutral">
            Crédito por faixa de parcelas
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() =>
                setRows((current) => {
                  const last = current
                    .filter((row) => row.payment_method === "CREDIT_CARD")
                    .reduce(
                      (max, row) => Math.max(max, row.installments_to),
                      0,
                    );
                  const from = Math.min(last + 1, MAX_INSTALLMENTS);
                  return [
                    ...current,
                    newRow("CREDIT_CARD", from, MAX_INSTALLMENTS),
                  ];
                })
              }
              className="inline-flex items-center gap-1 text-sm font-medium text-orange hover:underline"
            >
              <Plus className="h-4 w-4" /> Adicionar faixa
            </button>
          )}
        </div>

        {creditRows.map((row) => (
          <RuleFields
            key={row.key}
            row={row}
            sample={sample}
            disabled={!canManage}
            onChange={(patch) => update(row.key, patch)}
            onRemove={
              canManage
                ? () =>
                    setRows((current) =>
                      current.filter((candidate) => candidate.key !== row.key),
                    )
                : undefined
            }
          />
        ))}

        {creditRows.length === 0 && (
          <p className="text-sm text-gray-neutral">
            Sem faixas de crédito: vendas no crédito ficam sem taxa.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-surface-muted p-4">
        <div className="w-40">
          <Label htmlFor={`sample-${terminalId}`}>Simular venda de</Label>
          <CurrencyInput
            id={`sample-${terminalId}`}
            cents={sample}
            onCentsChange={setSample}
          />
        </div>
        <p className="text-xs text-gray-neutral">
          O valor à direita de cada linha é o que sobra para o petshop depois da
          taxa da operadora.
        </p>
      </div>

      {overlapError && <p className="text-sm text-danger">{overlapError}</p>}
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {saved && <p className="text-sm text-success">Taxas salvas.</p>}

      {canManage && (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !!overlapError}>
            {pending ? "Salvando..." : "Salvar taxas"}
          </Button>
        </div>
      )}
    </form>
  );
}

function RuleFields({
  row,
  sample,
  disabled,
  onChange,
  onRemove,
}: {
  row: Row;
  sample: number | null;
  disabled: boolean;
  onChange: (patch: Partial<Row>) => void;
  onRemove?: () => void;
}) {
  const isCredit = row.payment_method === "CREDIT_CARD";
  const amount = sample ?? 0;
  const fee = computeFeeCents(amount, asRule(row));

  return (
    <div className="grid gap-3 rounded-xl border border-graphite/10 p-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]">
      <div>
        <Label>Forma</Label>
        {isCredit ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={MAX_INSTALLMENTS}
              aria-label="Parcela inicial da faixa"
              value={row.installments_from}
              disabled={disabled}
              onChange={(event) =>
                onChange({ installments_from: Number(event.target.value) || 1 })
              }
            />
            <span className="text-sm text-gray-neutral">a</span>
            <Input
              type="number"
              min={1}
              max={MAX_INSTALLMENTS}
              aria-label="Parcela final da faixa"
              value={row.installments_to}
              disabled={disabled}
              onChange={(event) =>
                onChange({ installments_to: Number(event.target.value) || 1 })
              }
            />
            <span className="text-sm text-gray-neutral">x</span>
          </div>
        ) : (
          <p className="flex h-11 items-center text-sm font-medium text-graphite">
            {PAYMENT_METHOD_LABEL[row.payment_method]}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor={`percent-${row.key}`}>Taxa (%)</Label>
        <Input
          id={`percent-${row.key}`}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          max="100"
          value={row.fee_percent}
          disabled={disabled}
          onChange={(event) => onChange({ fee_percent: event.target.value })}
        />
      </div>

      <div>
        <Label htmlFor={`fixed-${row.key}`}>Tarifa fixa</Label>
        <CurrencyInput
          id={`fixed-${row.key}`}
          cents={row.fee_fixed_cents}
          disabled={disabled}
          onCentsChange={(cents) => onChange({ fee_fixed_cents: cents ?? 0 })}
        />
      </div>

      <div>
        <Label htmlFor={`days-${row.key}`}>Recebe em (dias)</Label>
        <Input
          id={`days-${row.key}`}
          type="number"
          min="0"
          max="365"
          value={row.settlement_days}
          disabled={disabled}
          onChange={(event) =>
            onChange({ settlement_days: Number(event.target.value) || 0 })
          }
        />
      </div>

      <div className="flex items-end justify-between gap-2 lg:flex-col lg:items-end lg:justify-end">
        <div className="text-right">
          <p className="text-xs text-gray-neutral">Você recebe</p>
          <p className="text-sm font-semibold text-graphite">
            {formatBRL(amount - fee)}
          </p>
          {fee > 0 && (
            <p className="text-xs text-danger">− {formatBRL(fee)} de taxa</p>
          )}
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remover faixa ${rangeLabel(row)}`}
            className="rounded-lg p-2 text-gray-neutral hover:bg-danger/10 hover:text-danger"
          >
            <Minus className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
