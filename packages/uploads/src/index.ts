import { createHash } from "node:crypto";
import sharp from "sharp";
import { detectKind, findHiddenCode, latin1, scanPdf } from "./inspect";

// Porta de entrada de TODO arquivo enviado ao Pet Live Pro (fotos, logo,
// anexos do suporte). Só servidor: usa sharp e zlib.
//
//   * o tipo é decidido pelos bytes, nunca pelo nome ou pelo navegador;
//   * imagem é sempre regravada (WEBP, lado máximo limitado): o que estiver
//     escondido nos bytes originais — script, metadado, GPS da foto — não
//     sobrevive à regravação;
//   * PDF não é regravado: é lido por inteiro atrás de conteúdo ativo;
//   * o que só um atacante mandaria volta como `threat`, para o app registrar
//     e a equipe ver em admin → Segurança. Recusa comum (formato errado,
//     arquivo grande) não é alarme.

export { detectKind, findHiddenCode, scanPdf } from "./inspect";

export type UploadThreatReason = "DISGUISED" | "HIDDEN_CODE" | "PDF_ACTIVE_CONTENT" | "IMAGE_BOMB";

export type UploadThreat = {
  reason: UploadThreatReason;
  /** O que o arquivo é de verdade / o que foi achado nele. */
  detected: string;
  fileName: string;
  declaredType: string;
  size: number;
  sha256: string;
};

export type CleanFile = {
  bytes: Uint8Array;
  mime: string;
  ext: string;
  /** Nome para exibir (sem caminho, sem caractere estranho, extensão do formato final). */
  name: string;
};

export type UploadCheck = { ok: true; file: CleanFile } | { ok: false; error: string; threat?: UploadThreat };

export type UploadPolicy = {
  accept: "image" | "image-or-pdf";
  /** Maior lado da imagem regravada, em px. */
  maxSide?: number;
  /** Tamanho máximo do arquivo enviado. O corpo da action já corta em 4,5 MB. */
  maxBytes?: number;
};

const MB = 1024 * 1024;
/** Acima disto a imagem é recusada (foto de celular de 200 MP fica abaixo). */
const MAX_PIXELS = 220_000_000;
/** Acima disto não existe câmera: é arquivo montado para estourar a memória. */
const BOMB_PIXELS = 400_000_000;

export const UPLOAD_ERRORS = {
  blocked: "Este arquivo foi bloqueado por segurança. Envie uma foto ou um print comum.",
  tooLarge: (mb: number) => `O arquivo passa de ${mb} MB. Envie um menor.`,
  image: "Envie uma imagem em JPG, PNG ou WEBP.",
  imageOrPdf: "Envie uma imagem (JPG, PNG, WEBP) ou um PDF.",
  heic: "Foto em HEIC (iPhone) não é aceita. Envie em JPG — no iPhone: Ajustes › Câmera › Formatos › Mais Compatível.",
  corrupt: "Não foi possível ler esta imagem. Ela pode estar corrompida; tente outra.",
  huge: "A imagem tem dimensões grandes demais. Envie uma foto ou print comum.",
  pdfActive:
    "Este PDF tem conteúdo ativo (script, programa ou arquivo embutido) e foi bloqueado por segurança. Envie um print da tela ou um PDF simples.",
} as const;

function cleanName(name: string, ext: string) {
  const base = name
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]*$/, "")
    .replace(/[^\p{L}\p{N}._ -]/gu, "")
    .trim()
    .slice(0, 100);
  return `${base || "arquivo"}.${ext}`;
}

export async function checkUpload(entry: File, policy: UploadPolicy): Promise<UploadCheck> {
  const maxBytes = policy.maxBytes ?? 4.5 * MB;
  if (entry.size > maxBytes) return { ok: false, error: UPLOAD_ERRORS.tooLarge(Math.floor(maxBytes / MB)) };

  const bytes = new Uint8Array(await entry.arrayBuffer());
  const base = {
    fileName: entry.name.slice(0, 160) || "(sem nome)",
    declaredType: (entry.type || "(não informado)").slice(0, 100),
    size: bytes.byteLength,
  };
  const threat = (reason: UploadThreatReason, detected: string): UploadCheck => ({
    ok: false,
    error: reason === "PDF_ACTIVE_CONTENT" ? UPLOAD_ERRORS.pdfActive : UPLOAD_ERRORS.blocked,
    threat: { reason, detected, ...base, sha256: createHash("sha256").update(bytes).digest("hex") },
  });
  const wrongType = policy.accept === "image" ? UPLOAD_ERRORS.image : UPLOAD_ERRORS.imageOrPdf;

  const kind = detectKind(bytes);
  if (kind.family === "dangerous") return threat("DISGUISED", kind.label);

  // Código escondido em arquivo que parece legítimo (imagem com PHP no meio).
  if (kind.family !== "pdf") {
    const hidden = findHiddenCode(latin1(bytes));
    if (hidden.length) return threat("HIDDEN_CODE", `${kind.label} com ${hidden.join(", ")}`);
  }

  if (kind.family === "unsupported") return { ok: false, error: kind.label.startsWith("Foto HEIC") ? UPLOAD_ERRORS.heic : wrongType };
  if (kind.family === "unknown") return { ok: false, error: wrongType };

  if (kind.family === "pdf") {
    if (policy.accept !== "image-or-pdf") return { ok: false, error: wrongType };
    const found = scanPdf(bytes);
    if (found.length) return threat("PDF_ACTIVE_CONTENT", `PDF com ${found.join(", ")}`);
    return { ok: true, file: { bytes, mime: "application/pdf", ext: "pdf", name: cleanName(entry.name, "pdf") } };
  }

  // Imagem: confere as dimensões pelo cabeçalho (sem decodificar) e regrava.
  let width = 0;
  let height = 0;
  try {
    const meta = await sharp(bytes, { limitInputPixels: false }).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    return { ok: false, error: UPLOAD_ERRORS.corrupt };
  }
  if (!width || !height) return { ok: false, error: UPLOAD_ERRORS.corrupt };
  if (width * height > BOMB_PIXELS) return threat("IMAGE_BOMB", `${kind.label} de ${width}×${height} px (feita para travar o servidor)`);
  if (width * height > MAX_PIXELS) return { ok: false, error: UPLOAD_ERRORS.huge };

  const side = policy.maxSide ?? 1600;
  try {
    const out = await sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: "error", animated: false })
      .rotate()
      .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return { ok: true, file: { bytes: new Uint8Array(out), mime: "image/webp", ext: "webp", name: cleanName(entry.name, "webp") } };
  } catch {
    return { ok: false, error: UPLOAD_ERRORS.corrupt };
  }
}

/** Arquivos de um campo do formulário (ignora os vazios que o navegador manda). */
export function filesFrom(formData: FormData, field: string): File[] {
  return formData.getAll(field).filter((f): f is File => typeof f !== "string" && f.size > 0);
}
