import { Search } from "lucide-react";
import { Button, Label } from "@mylivepet/ui";
import { SuggestInput, type SuggestKind } from "@/components/suggest-input";

/**
 * Busca por GET: o filtro vira URL, então dá para compartilhar e voltar.
 * Enquanto se digita, o campo sugere resultados (`suggest`).
 */
export function SearchForm({
  action,
  suggest,
  value,
  placeholder,
  hidden = {},
  children,
}: {
  action: string;
  suggest: SuggestKind;
  value?: string;
  placeholder: string;
  hidden?: Record<string, string | undefined>;
  children?: React.ReactNode;
}) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-end gap-3" role="search">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <div className="min-w-[220px] flex-[2_1_260px]">
        <Label htmlFor="busca">Buscar</Label>
        <SuggestInput key={value ?? ""} kind={suggest} id="busca" name="q" defaultValue={value} placeholder={placeholder} />
      </div>
      {children}
      <Button type="submit" variant="secondary" className="h-11">
        <Search className="h-4 w-4" aria-hidden /> Buscar
      </Button>
    </form>
  );
}
