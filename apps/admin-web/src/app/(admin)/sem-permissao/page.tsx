import Link from "next/link";
import { Lock } from "lucide-react";
import { EmptyState } from "@mylivepet/ui";
import { requireAdminPage } from "@/lib/auth";
import { PageBody, PageHeader } from "@/components/page-header";

export default async function SemPermissaoPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="Sem permissão" />
      <PageBody>
        <EmptyState
          icon={<Lock className="h-6 w-6" />}
          title="Seu papel não alcança esta área"
          description="Se precisar dela, peça a um superadmin para revisar o seu acesso."
          action={
            <Link href="/" className="text-sm font-semibold text-petrol hover:underline">
              Voltar para a visão geral
            </Link>
          }
        />
      </PageBody>
    </>
  );
}
