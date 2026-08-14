import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  PaymentFeeRule,
  PaymentTerminalDTO,
} from "@mylivepet/types";

/**
 * Maquininhas do petshop com a grade de taxas de cada uma
 * (supabase/migrations/0036_payment_terminal_fees.sql).
 *
 * As telas de venda usam `activeOnly` para não oferecer uma maquininha
 * aposentada; a tela de configuração lista todas.
 */
export async function loadPaymentTerminals(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  { activeOnly = false }: { activeOnly?: boolean } = {},
): Promise<PaymentTerminalDTO[]> {
  let query = supabase
    .from("payment_terminal")
    .select("id, name, active, is_default")
    .eq("tenant_id", tenantId);
  if (activeOnly) query = query.eq("active", true);

  const [{ data: terminals }, { data: rules }] = await Promise.all([
    query.order("name"),
    supabase
      .from("payment_fee_rule")
      .select(
        "terminal_id, payment_method, installments_from, installments_to, fee_percent, fee_fixed_cents, settlement_days",
      )
      .eq("tenant_id", tenantId)
      .order("installments_from"),
  ]);

  const byTerminal = new Map<string, PaymentFeeRule[]>();
  for (const rule of rules ?? []) {
    const list = byTerminal.get(rule.terminal_id) ?? [];
    list.push({
      payment_method: rule.payment_method,
      installments_from: rule.installments_from,
      installments_to: rule.installments_to,
      // numeric(6,3) chega como string no supabase-js.
      fee_percent: Number(rule.fee_percent),
      fee_fixed_cents: rule.fee_fixed_cents,
      settlement_days: rule.settlement_days,
    });
    byTerminal.set(rule.terminal_id, list);
  }

  return (terminals ?? []).map((terminal) => ({
    id: terminal.id,
    name: terminal.name,
    active: terminal.active,
    is_default: terminal.is_default,
    rules: byTerminal.get(terminal.id) ?? [],
  }));
}
