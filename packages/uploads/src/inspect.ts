import { inflateSync } from "node:zlib";

// Inspeção pelos BYTES. Nome, extensão e content-type vêm do navegador e não
// valem nada como prova: um .jpg pode ser um .exe renomeado. Aqui se descobre
// o que o arquivo é de verdade e se carrega algo que só um atacante colocaria.

export type FileKind =
  | { family: "image"; mime: string; label: string }
  | { family: "pdf"; mime: "application/pdf"; label: string }
  /** Formato legítimo que não aceitamos (ex.: HEIC do iPhone). Recusa sem alarme. */
  | { family: "unsupported"; label: string }
  /** Executável, script, página ou compactado: ninguém manda isso sem querer como foto. */
  | { family: "dangerous"; label: string }
  | { family: "unknown"; label: string };

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => Buffer.from(b.subarray(from, to)).toString("latin1");

export function detectKind(b: Uint8Array): FileKind {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { family: "image", mime: "image/png", label: "Imagem PNG" };
  if (startsWith(b, [0xff, 0xd8, 0xff])) return { family: "image", mime: "image/jpeg", label: "Imagem JPG" };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return { family: "image", mime: "image/webp", label: "Imagem WEBP" };
  if (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a") return { family: "image", mime: "image/gif", label: "Imagem GIF" };
  if (ascii(b, 4, 8) === "ftyp") {
    const brand = ascii(b, 8, 12);
    if (brand === "avif" || brand === "avis") return { family: "image", mime: "image/avif", label: "Imagem AVIF" };
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) return { family: "unsupported", label: "Foto HEIC (iPhone)" };
    return { family: "unsupported", label: "Vídeo" };
  }
  if (ascii(b, 0, 5) === "%PDF-") return { family: "pdf", mime: "application/pdf", label: "PDF" };

  // Binários executáveis e compactados.
  if (startsWith(b, [0x4d, 0x5a])) return { family: "dangerous", label: "Programa do Windows (.exe/.dll)" };
  if (startsWith(b, [0x7f, 0x45, 0x4c, 0x46])) return { family: "dangerous", label: "Programa do Linux (ELF)" };
  if (
    startsWith(b, [0xfe, 0xed, 0xfa, 0xce]) ||
    startsWith(b, [0xfe, 0xed, 0xfa, 0xcf]) ||
    startsWith(b, [0xce, 0xfa, 0xed, 0xfe]) ||
    startsWith(b, [0xcf, 0xfa, 0xed, 0xfe])
  ) {
    return { family: "dangerous", label: "Programa do macOS (Mach-O)" };
  }
  if (startsWith(b, [0xca, 0xfe, 0xba, 0xbe])) return { family: "dangerous", label: "Programa Java ou macOS" };
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) return { family: "dangerous", label: "Arquivo compactado (ZIP, APK, JAR ou Office)" };
  if (ascii(b, 0, 4) === "Rar!") return { family: "dangerous", label: "Arquivo compactado (RAR)" };
  if (startsWith(b, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return { family: "dangerous", label: "Arquivo compactado (7z)" };
  if (startsWith(b, [0x1f, 0x8b])) return { family: "dangerous", label: "Arquivo compactado (gzip)" };
  if (ascii(b, 0, 4) === "MSCF") return { family: "dangerous", label: "Instalador do Windows (CAB)" };
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0])) return { family: "dangerous", label: "Documento Office antigo (pode ter macro)" };

  // Texto: script, página, SVG. Ignora BOM e espaços do começo.
  const head = ascii(b, 0, 1024).replace(/^ï»¿/, "").trimStart().toLowerCase();
  if (head.startsWith("#!")) return { family: "dangerous", label: "Script de terminal (shell, Python, Perl)" };
  if (head.startsWith("<?php") || head.startsWith("<?=")) return { family: "dangerous", label: "Script PHP" };
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return { family: "dangerous", label: "Imagem SVG (pode conter script)" };
  if (/^<(!doctype html|html|head|body|script|iframe|meta|a\s|div|img\s)/.test(head)) return { family: "dangerous", label: "Página HTML" };
  if (head.startsWith("<?xml")) return { family: "dangerous", label: "Documento XML" };
  if (head.startsWith("%!ps")) return { family: "dangerous", label: "Arquivo PostScript" };
  if (head.startsWith("{\\rtf")) return { family: "dangerous", label: "Documento RTF (pode ter objeto embutido)" };
  if (/^(@echo|powershell|set-executionpolicy|function\s|var\s|const\s|import\s)/.test(head)) {
    return { family: "dangerous", label: "Script (Windows ou JavaScript)" };
  }
  return { family: "unknown", label: "Formato desconhecido" };
}

// ---------------------------------------------------------------------
// Código escondido dentro de um arquivo "válido" (poliglota): imagem com PHP
// no meio, PDF com comando de shell reversa. Cada padrão tem tamanho e forma
// que não aparecem por acaso em bytes de imagem comprimida.
// ---------------------------------------------------------------------

const HIDDEN: [RegExp, string][] = [
  [/<\?php/i, "código PHP"],
  [/<script[\s>]/i, "script de página (JavaScript)"],
  [/\/dev\/(tcp|udp)\/[\w.-]+\/\d+/, "shell reversa (/dev/tcp)"],
  [/\b(ba|z|k)?sh\s+-i\b/, "shell interativa (sh -i)"],
  [/\bnc(at)?(\.exe)?\s+(-\w+\s+)*-(e|c)\s/, "shell reversa com netcat"],
  [/system\.net\.sockets\.tcpclient/i, "shell reversa em PowerShell"],
  [/\b(powershell|pwsh)(\.exe)?\s+(-\w+\s+)*-(e|enc|encodedcommand)\s/i, "PowerShell com comando ofuscado"],
  [/\bsocket\.socket\([^)]*\)[\s\S]{0,200}\b(subprocess|os\.dup2|pty\.spawn)/, "shell reversa em Python"],
  [/\b(eval|assert)\s*\(\s*(base64_decode|gzinflate|str_rot13)\s*\(/i, "código PHP ofuscado"],
  [/\b(shell_exec|passthru|proc_open)\s*\(/i, "execução de comando no servidor"],
  [/\bcmd(\.exe)?\s+\/c\s/i, "comando do Windows (cmd /c)"],
];

export function findHiddenCode(text: string): string[] {
  return [...new Set(HIDDEN.filter(([re]) => re.test(text)).map(([, label]) => label))];
}

export function latin1(b: Uint8Array) {
  return Buffer.from(b.buffer, b.byteOffset, b.byteLength).toString("latin1");
}

// ---------------------------------------------------------------------
// PDF: conteúdo ativo. Um PDF de print, boleto ou relatório não precisa de
// nada disto; quem coloca script, comando de abrir programa ou arquivo
// embutido num PDF mandado ao suporte está tentando algo.
// ---------------------------------------------------------------------

const PDF_ACTIVE: [RegExp, string][] = [
  [/\/JavaScript\b/, "script embutido (JavaScript)"],
  [/\/JS\b/, "script embutido (JavaScript)"],
  [/\/Launch\b/, "comando para abrir programa"],
  [/\/EmbeddedFiles?\b/, "arquivo escondido dentro do PDF"],
  [/\/RichMedia\b/, "mídia ativa (Flash)"],
  [/\/XFA\b/, "formulário dinâmico (XFA)"],
  [/\/ImportData\b/, "importação de dados externos"],
  [/\/SubmitForm\b/, "envio automático de dados"],
];

const MAX_STREAMS = 4000;
const MAX_INFLATED = 32 * 1024 * 1024;

/**
 * Lê o PDF inteiro, inclusive os fluxos comprimidos (onde um atacante
 * esconde os objetos), e devolve o que achou de conteúdo ativo ou código.
 * Nomes com escape (/J#61vaScript) são normalizados antes da busca.
 */
export function scanPdf(b: Uint8Array): string[] {
  const raw = latin1(b);
  const parts = [raw];
  let inflated = 0;
  let streams = 0;
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) && streams < MAX_STREAMS && inflated < MAX_INFLATED) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    streams += 1;
    try {
      const out = inflateSync(Buffer.from(raw.slice(start, end), "latin1"), {
        maxOutputLength: Math.min(8 * 1024 * 1024, MAX_INFLATED - inflated),
      });
      inflated += out.length;
      parts.push(out.toString("latin1"));
    } catch {
      // Fluxo sem compressão zlib (imagem, fonte) ou corrompido: o texto cru já foi lido.
    }
    re.lastIndex = end;
  }
  const text = parts.join("\n").replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  const active = PDF_ACTIVE.filter(([rx]) => rx.test(text)).map(([, label]) => label);
  return [...new Set([...active, ...findHiddenCode(text)])];
}
