import { Crown } from "lucide-react";
import { cn } from "@mylivepet/ui";
import type { ClubinhoSubscriptionDTO } from "@mylivepet/types";

/**
 * Selo de assinante do Clubinho, exibido no card do PET.
 *
 * Já morou junto à identidade do petshop, no menu, quando o Clubinho era um
 * sim/não do tutor. Com a assinatura por pet (0047) o selo ali passou a mentir:
 * um tutor com dois cães, só um no pacote, via "Clubinho ativo" sem que isso
 * dissesse de qual pet era o banho. Devolve null quando o pet não assina, para
 * os pontos de uso ficarem sem condicional.
 *
 * Petrol, e não laranja, porque no app o laranja marca o item de navegação ativo.
 */
export function ClubinhoBadge({
  subscription,
  className,
}: {
  subscription: ClubinhoSubscriptionDTO | null | undefined;
  className?: string;
}) {
  if (!subscription) return null;

  const paused = subscription.status !== "ACTIVE";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-petrol/10 px-2 py-0.5 text-xs font-medium text-petrol",
        className,
      )}
      title={
        paused
          ? `${subscription.plan_name} · pausado`
          : `${subscription.plan_name} · ${subscription.credits_left} serviço(s) no ciclo`
      }
    >
      <Crown className="h-3 w-3 shrink-0" />
      {paused
        ? "Clubinho pausado"
        : `Clubinho · ${subscription.credits_left} no ciclo`}
    </span>
  );
}
