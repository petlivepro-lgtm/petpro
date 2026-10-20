/** Idade a partir da data de nascimento, em anos e meses. */
export function ageFrom(birth: string | null): string | null {
  if (!birth) return null;
  const b = new Date(birth);
  const now = new Date();
  let months =
    (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return (
    [
      y > 0 ? `${y} ano${y > 1 ? "s" : ""}` : null,
      m > 0 ? `${m} mes${m > 1 ? "es" : ""}` : null,
    ]
      .filter(Boolean)
      .join(", ") || "recém-nascido"
  );
}
