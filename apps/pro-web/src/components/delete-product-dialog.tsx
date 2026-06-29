"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@mylivepet/ui";
import { deleteProduct, type FormState } from "@/app/(app)/produtos/actions";

export function DeleteProductDialog({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(deleteProduct, {
    ok: false,
  });

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

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
          description={`"${productName}" será removido do catálogo. Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          pendingLabel="Excluindo..."
          confirmVariant="danger"
          confirmType="submit"
          pending={pending}
          error={state.error}
        />
      </form>
    </>
  );
}
