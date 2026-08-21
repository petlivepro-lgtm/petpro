/**
 * Contas de cor compartilhadas: normalização de hexadecimal, conversão para
 * HSV (o seletor livre trabalha nesse espaço) e ajuste de contraste.
 *
 * Vive no design system porque tanto o seletor quanto quem pinta a cor depois
 * precisam da mesma resposta — duas implementações da mesma conta acabariam
 * discordando sobre o que é "claro demais".
 */

export type Hsv = { h: number; s: number; v: number };

/**
 * "2d6cdf", "#2DF", "#2d6cdf" → "#2D6CDF". Devolve `null` para qualquer coisa
 * que não seja um hexadecimal de 3 ou 6 dígitos — quem chama decide o que
 * fazer com a digitação pela metade.
 */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw}`.toUpperCase();
  return null;
}

export function hexToRgb(hex: string): [number, number, number] {
  const v = normalizeHex(hex)?.slice(1) ?? "000000";
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = hexToRgb(hex).map((n) => n / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const seg = Math.floor(h / 60) % 6;
  const [r, g, b] = (
    [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ] as const
  )[seg]!;
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** Luminância relativa (WCAG), 0 = preto, 1 = branco. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((n) => {
    const c = n / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Cor clara o bastante para o check por cima precisar ser escuro. */
export function isLightHex(hex: string): boolean {
  return luminance(hex) > 0.55;
}

/** Contraste WCAG entre duas luminâncias já calculadas. */
function ratio(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * A mesma cor, escurecida só o quanto precisar para servir de texto sobre um
 * fundo quase branco (o badge da agenda pinta o fundo com a cor a 12%).
 *
 * Sem isso, liberar a escolha da cor libera amarelo-limão — e o nome do serviço
 * some do card. Escurece a tinta em vez de recusar a cor: a bolinha e o fundo
 * continuam exatamente na cor que o petshop escolheu.
 */
export function readableInk(hex: string, background = "#FFFFFF"): string {
  const bg = luminance(background);
  const base = normalizeHex(hex) ?? "#000000";
  if (ratio(luminance(base), bg) >= 4.5) return base;

  const hsv = hexToHsv(base);
  // Passos pequenos no brilho: o suficiente para parar assim que atinge o
  // contraste, sem transformar a cor num quase-preto.
  for (let v = hsv.v; v > 0.02; v -= 0.02) {
    const candidate = hsvToHex({ ...hsv, v });
    if (ratio(luminance(candidate), bg) >= 4.5) return candidate;
  }
  return "#1F2A33"; // grafite: último recurso para cores impossíveis
}
