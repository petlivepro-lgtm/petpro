import { Crown } from "lucide-react";
import { cn } from "@mylivepet/ui";

/**
 * Selo de assinante do Clubinho, exibido junto à identidade do petshop no
 * menu. Devolve null quando o tutor não é membro, para os pontos de uso
 * ficarem sem condicional. Petrol, e não laranja, porque no menu o laranja
 * marca o item de navegação ativo.
 */
export function ClubinhoBadge({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  if (!active) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-petrol/10 px-2 py-0.5 text-xs font-medium text-petrol",
        className,
      )}
    >
      <Crown className="h-3 w-3" /> Clubinho ativo
    </span>
  );
}
