/** 11987654321 → 5511987654321 (WhatsApp precisa do DDI). */
export function waNumber(phone: string | null) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}
