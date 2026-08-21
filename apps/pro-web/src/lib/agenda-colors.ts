import { readableInk, type ColorOption } from "@mylivepet/ui";

/**
 * Paleta da agenda: a cor que identifica o serviço no card do calendário e na
 * legenda do topo. Os mesmos hexes dos tiles de ação do painel, para o petshop
 * não ver dois vocabulários de cor no mesmo produto.
 *
 * A ordem importa: é ela que o fallback percorre, então serviços diferentes de
 * um catálogo pequeno saem com cores bem distintas entre si.
 */
export const AGENDA_COLORS: readonly ColorOption[] = [
  { name: "Azul", hex: "#2D6CDF" },
  { name: "Roxo", hex: "#7A3FB0" },
  { name: "Verde", hex: "#2E9E5B" },
  { name: "Dourado", hex: "#C0892D" },
  { name: "Laranja", hex: "#F08A24" },
  { name: "Rosa", hex: "#E0556B" },
  { name: "Turquesa", hex: "#159E8C" },
  { name: "Petróleo", hex: "#1D6E84" },
  { name: "Vermelho", hex: "#C0392B" },
  { name: "Cinza", hex: "#5B6770" },
];

const FALLBACK = "#5B6770";

/** Hash estável (djb2) — a cor não pode mudar entre um render e outro. */
function hash(value: string): number {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = (h * 33) ^ value.charCodeAt(i);
  return Math.abs(h);
}

/**
 * Cor do serviço: a cadastrada, ou uma derivada do id enquanto o petshop não
 * escolheu — assim um catálogo antigo já entra colorido na agenda, sem
 * ninguém precisar reeditar serviço por serviço.
 */
export function serviceColor(
  serviceId: string | null,
  colorHex: string | null,
): string {
  if (colorHex) return colorHex;
  if (!serviceId) return FALLBACK;
  return AGENDA_COLORS[hash(serviceId) % AGENDA_COLORS.length]!.hex;
}

/**
 * Tinta do texto do badge: a mesma cor, escurecida só se precisar para o nome
 * do serviço não sumir. Existe porque o petshop pode escolher qualquer cor no
 * seletor livre, inclusive um amarelo que some no fundo claro do card.
 */
export function serviceInk(
  serviceId: string | null,
  colorHex: string | null,
): string {
  return readableInk(serviceColor(serviceId, colorHex));
}

/** Nome da paleta a partir do hex — o ColorSwatchInput seleciona por nome. */
export function colorNameOf(colorHex: string | null | undefined): string | null {
  if (!colorHex) return null;
  const target = colorHex.toLowerCase();
  return AGENDA_COLORS.find((c) => c.hex.toLowerCase() === target)?.name ?? null;
}
