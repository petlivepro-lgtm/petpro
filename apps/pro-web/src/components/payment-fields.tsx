"use client";

import { useEffect, useState } from "react";
import { Label, Select } from "@mylivepet/ui";
import {
  computeFeeCents,
  findFeeRule,
  formatBRL,
  MAX_INSTALLMENTS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  supportsInstallments,
  usesPaymentTerminal,
  type PaymentMethod,
  type PaymentTerminalDTO,
} from "@mylivepet/types";

/**
 * Forma de pagamento + maquininha + parcelas, com a prévia do que sobra depois
 * da taxa da operadora. Usado em toda cobrança (balcão, reserva e atendimento)
 * para que o operador veja o líquido antes de confirmar.
 *
 * As taxas vêm de /configuracoes/pagamentos; o cálculo aqui espelha
 * resolve_payment_fee (0036) — quem grava o valor final é sempre o banco.
 */
export function PaymentFields({
  terminals,
  amountCents,
  idPrefix,
  className = "space-y-4",
}: {
  terminals: PaymentTerminalDTO[];
  /** Valor da cobrança, quando conhecido, para a prévia do líquido. */
  amountCents?: number;
  idPrefix: string;
  className?: string;
}) {
  const usable = terminals.filter((terminal) => terminal.active);
  const preferred = usable.find((terminal) => terminal.is_default) ?? usable[0];

  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [terminalId, setTerminalId] = useState<string>(preferred?.id ?? "");
  const [installments, setInstallments] = useState(1);

  // Trocar para uma forma que não parcela desfaz o parcelamento escolhido
  // antes — o banco recusa crédito parcelado em débito/dinheiro.
  useEffect(() => {
    if (method && !supportsInstallments(method)) setInstallments(1);
  }, [method]);

  const showTerminal =
    usable.length > 0 && !!method && usesPaymentTerminal(method);
  const showInstallments = !!method && supportsInstallments(method);

  const terminal = usable.find((candidate) => candidate.id === terminalId);
  const rule =
    showTerminal && terminal && method
      ? findFeeRule(terminal.rules, method, installments)
      : null;
  const fee =
    amountCents !== undefined ? computeFeeCents(amountCents, rule) : 0;

  return (
    <div className={className}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-payment`}>Forma de pagamento *</Label>
          <Select
            id={`${idPrefix}-payment`}
            name="payment_method"
            required
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
          >
            <option value="" disabled>
              Selecione
            </option>
            {PAYMENT_METHODS.map((option) => (
              <option key={option} value={option}>
                {PAYMENT_METHOD_LABEL[option]}
              </option>
            ))}
          </Select>
        </div>

        {showTerminal && (
          <div>
            <Label htmlFor={`${idPrefix}-terminal`}>Maquininha</Label>
            <Select
              id={`${idPrefix}-terminal`}
              name="terminal_id"
              value={terminalId}
              onChange={(event) => setTerminalId(event.target.value)}
            >
              <option value="">Sem maquininha</option>
              {usable.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                  {option.is_default ? " · padrão" : ""}
                </option>
              ))}
            </Select>
          </div>
        )}

        {showInstallments && (
          <div>
            <Label htmlFor={`${idPrefix}-installments`}>Parcelas</Label>
            <Select
              id={`${idPrefix}-installments`}
              name="installments"
              value={installments}
              onChange={(event) => setInstallments(Number(event.target.value))}
            >
              {Array.from(
                { length: MAX_INSTALLMENTS },
                (_, index) => index + 1,
              ).map((count) => (
                <option key={count} value={count}>
                  {count}x
                  {amountCents !== undefined && count > 1
                    ? ` de ${formatBRL(Math.round(amountCents / count))}`
                    : ""}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {showTerminal && terminal && (
        <p className="text-xs text-gray-neutral">
          {rule ? (
            <>
              Taxa de {Number(rule.fee_percent).toLocaleString("pt-BR")}%
              {rule.fee_fixed_cents > 0
                ? ` + ${formatBRL(rule.fee_fixed_cents)}`
                : ""}
              {rule.settlement_days > 0
                ? ` · recebe em D+${rule.settlement_days}`
                : ""}
              {amountCents !== undefined && amountCents > 0 && (
                <>
                  {" "}
                  · líquido{" "}
                  <strong className="text-graphite">
                    {formatBRL(amountCents - fee)}
                  </strong>{" "}
                  <span className="text-danger">(− {formatBRL(fee)})</span>
                </>
              )}
            </>
          ) : (
            <>
              Sem taxa cadastrada para essa forma em {terminal.name} — o líquido
              será igual ao bruto.
            </>
          )}
        </p>
      )}
    </div>
  );
}
