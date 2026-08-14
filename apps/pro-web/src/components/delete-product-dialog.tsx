"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Trash2, X } from "lucide-react";
import { Checkbox, ConfirmDialog } from "@mylivepet/ui";
import {
  deleteProduct,
  getProductDeletionImpact,
  type DeleteProductState,
  type ProductDeletionImpact,
} from "@/app/(app)/produtos/actions";

function plural(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function DeleteProductDialog({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<ProductDeletionImpact | null>(null);
  const [ack, setAck] = useState(false);
  const [state, formAction, pending] = useActionState<DeleteProductState, FormData>(
    deleteProduct,
    { ok: false },
  );

  // O aviso só é honesto se souber o que existe atrás do produto: o impacto é
  // lido ao abrir, e o popup fica travado até a resposta chegar.
  useEffect(() => {
    if (!open) {
      setImpact(null);
      setAck(false);
      return;
    }
    let alive = true;
    getProductDeletionImpact(productId)
      .then((data) => alive && setImpact(data))
      .catch(() => alive && setImpact(null));
    return () => {
      alive = false;
    };
  }, [open, productId]);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  // A action recalcula o impacto no servidor; o retorno dela manda no que o
  // popup mostra quando os dois discordam.
  const current = state.impact ?? impact;
  const loading = current === null;
  const blocked = (current?.activeReservations ?? 0) > 0;
  const hasHistory = (current?.pastReservations ?? 0) > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Excluir ${productName}`}
        className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <form action={formAction}>
        <input type="hidden" name="id" value={productId} />
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Excluir produto?"
          description={
            loading
              ? `Verificando o que está ligado a "${productName}"...`
              : blocked
                ? `"${productName}" não pode ser excluído agora.`
                : hasHistory
                  ? `"${productName}" já circulou no petshop — leia antes de confirmar.`
                  : `"${productName}" será removido do catálogo. Esta ação não pode ser desfeita.`
          }
          confirmLabel={hasHistory ? "Excluir definitivamente" : "Excluir"}
          cancelLabel={blocked ? "Entendi" : "Cancelar"}
          confirmVariant="danger"
          confirmType="submit"
          confirmDisabled={loading || blocked || (hasHistory && !ack)}
          pending={pending}
          pendingLabel="Excluindo..."
          // Quando a reserva ativa aparece entre abrir e confirmar, quem explica
          // é o painel abaixo — repetir o texto no rodapé seria eco.
          error={state.blocked ? undefined : state.error}
        >
          {loading && (
            <p className="flex items-center gap-2 text-sm text-gray-neutral">
              <Loader2 className="h-4 w-4 animate-spin" />
              Conferindo reservas e histórico...
            </p>
          )}

          {!loading && blocked && current && (
            <Panel
              tone="danger"
              title={`${plural(current.activeReservations, "reserva em andamento", "reservas em andamento")} com este produto`}
            >
              <p>
                Enquanto houver reserva aberta, o tutor ainda espera retirar o item —
                excluir agora deixaria a reserva sem produto e o estoque sem volta.
              </p>
              <p className="mt-1.5">
                Conclua ou cancele em <strong>Solicitações</strong> e volte aqui. Se a
                intenção é só tirar do app, desative o produto na edição.
              </p>
            </Panel>
          )}

          {!loading && !blocked && hasHistory && current && (
            <>
              <Panel
                tone="warning"
                title={`Este produto tem histórico: ${plural(current.pastReservations, "reserva encerrada", "reservas encerradas")}${
                  current.sales > 0
                    ? `, ${plural(current.sales, "venda concluída", "vendas concluídas")}`
                    : ""
                }`}
              >
                <ul className="space-y-1.5">
                  <Line tone="keep">
                    Reservas antigas e o financeiro continuam registrados — o item passa a
                    aparecer como <strong>&quot;{productName}&quot;</strong>, sem link para o
                    catálogo.
                  </Line>
                  <Line tone="lose">
                    O produto some com fotos, preço, variações
                    {current.stockMovements > 0
                      ? ` e ${plural(current.stockMovements, "movimentação de estoque", "movimentações de estoque")}`
                      : ""}
                    .
                  </Line>
                  <Line tone="lose">
                    Não dá para recuperar: recadastrar cria um produto novo, sem esse
                    histórico.
                  </Line>
                </ul>
              </Panel>

              <Checkbox
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                label="Entendi que a exclusão é permanente."
              />
              {ack && <input type="hidden" name="confirm" value="1" />}
            </>
          )}
        </ConfirmDialog>
      </form>
    </>
  );
}

function Panel({
  tone,
  title,
  children,
}: {
  tone: "danger" | "warning";
  title: string;
  children: React.ReactNode;
}) {
  const danger = tone === "danger";
  return (
    <div
      className={`rounded-xl border p-3 ${
        danger ? "border-danger/25 bg-danger/5" : "border-warning/40 bg-warning/10"
      }`}
    >
      <p className="flex items-start gap-2 font-heading text-sm font-semibold text-graphite">
        <AlertTriangle
          className={`mt-0.5 h-4 w-4 shrink-0 ${danger ? "text-danger" : "text-[#8a6418]"}`}
        />
        <span>{title}</span>
      </p>
      <div className="mt-2 text-sm text-gray-neutral">{children}</div>
    </div>
  );
}

function Line({ tone, children }: { tone: "keep" | "lose"; children: React.ReactNode }) {
  const keep = tone === "keep";
  return (
    <li className="flex items-start gap-2">
      {keep ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      )}
      <span>{children}</span>
    </li>
  );
}
