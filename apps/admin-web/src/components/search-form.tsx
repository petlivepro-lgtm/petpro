import { Search } from "lucide-react";
import { Button, Input, Label } from "@mylivepet/ui";

/** Busca por GET: o filtro vira URL, então dá para compartilhar e voltar. */
export function SearchForm({
  action,
  value,
  placeholder,
  hidden = {},
  children,
}: {
  action: string;
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
        <Input
          id="busca"
          name="q"
          type="search"
          defaultValue={value}
          placeholder={placeholder}
          maxLength={120}
          className="focus-visible:ring-petrol"
        />
      </div>
      {children}
      <Button type="submit" variant="secondary" className="h-11">
        <Search className="h-4 w-4" aria-hidden /> Buscar
      </Button>
    </form>
  );
}
