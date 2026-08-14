import { CreditCard, Info } from "lucide-react";
import { Card, EmptyState, PageHeader, StatusChip } from "@mylivepet/ui";
import { canMutateAsRole } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { loadPaymentTerminals } from "@/lib/payment-terminals";
import { TerminalDialog } from "./terminal-dialog";
import { DeleteTerminalDialog } from "./delete-terminal-dialog";
import { FeeRulesForm } from "./fee-rules-form";

export default async function PagamentosPage() {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return null;

  const terminals = await loadPaymentTerminals(supabase, tenant.tenantId);
  const canManage = canMutateAsRole(tenant.role);
  const hasDefault = terminals.some(
    (terminal) => terminal.active && terminal.is_default,
  );

  return (
    <div>
      <PageHeader
        title="Maquininhas e taxas"
        subtitle="O que a operadora retém de cada venda no cartão e no Pix."
        actions={canManage ? <TerminalDialog /> : undefined}
      />

      <div className="space-y-6">
        <Card className="border-orange/30 bg-orange/5">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-orange" />
            <div className="space-y-1 text-sm text-graphite">
              <p>
                A taxa é aplicada no momento da venda e fica congelada no
                lançamento: no Financeiro cada receita mostra o bruto, quanto a
                operadora reteve e quanto sobrou de líquido.
              </p>
              <p className="text-gray-neutral">
                Renegociar a taxa depois vale só para as vendas seguintes — o
                histórico não muda.
              </p>
            </div>
          </div>
        </Card>

        {terminals.length > 0 && !hasDefault && (
          <Card className="border-warning/40 bg-warning/5">
            <p className="text-sm text-graphite">
              Nenhuma maquininha está marcada como padrão. Sem uma padrão, as
              vendas em que o operador não escolher a maquininha ficam sem taxa.
            </p>
          </Card>
        )}

        {terminals.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title="Nenhuma maquininha cadastrada"
            description="Cadastre a maquininha do petshop e informe a taxa de cada forma de pagamento. Sem isso, o financeiro considera que você recebe 100% de cada venda."
            action={canManage ? <TerminalDialog /> : undefined}
          />
        ) : (
          terminals.map((terminal) => (
            <Card key={terminal.id} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-graphite/5 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CreditCard className="h-5 w-5 text-orange" />
                  <p className="font-heading font-semibold text-graphite">
                    {terminal.name}
                  </p>
                  {terminal.is_default && (
                    <StatusChip tone="success">Padrão</StatusChip>
                  )}
                  {!terminal.active && (
                    <StatusChip tone="danger">Inativa</StatusChip>
                  )}
                </div>

                {canManage && (
                  <div className="flex items-center gap-1">
                    <TerminalDialog
                      terminal={{
                        id: terminal.id,
                        name: terminal.name,
                        active: terminal.active,
                        is_default: terminal.is_default,
                      }}
                    />
                    <DeleteTerminalDialog
                      terminalId={terminal.id}
                      name={terminal.name}
                    />
                  </div>
                )}
              </div>

              <FeeRulesForm
                terminalId={terminal.id}
                rules={terminal.rules}
                canManage={canManage}
              />
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
