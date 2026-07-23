// Uploader do gateway MyLivePet.
// Varre ./recordings a cada 30s; quando um segmento MP4 termina de ser
// gravado (sem escrita há 90s), pede uma signed upload URL ao app, sobe o
// arquivo DIRETO ao Supabase Storage, confirma o registro e apaga o local.
// Sem dependências — Node 22 (fetch nativo).

import { readdir, stat, readFile, unlink, rmdir } from "node:fs/promises";
import { join, basename } from "node:path";

const APP_URL = (process.env.APP_URL ?? "").replace(/\/$/, "");
const TOKEN = process.env.GATEWAY_UPLOAD_TOKEN ?? "";
const RECORDINGS_DIR = process.env.RECORDINGS_DIR ?? "/recordings";
const SCAN_INTERVAL_MS = 30_000;
const SETTLE_MS = 90_000; // segmento é considerado pronto sem escrita há 90s

if (!APP_URL || !TOKEN) {
  console.error("[uploader] APP_URL e GATEWAY_UPLOAD_TOKEN são obrigatórios");
  process.exit(1);
}

function log(...args) {
  console.log(new Date().toISOString(), "[uploader]", ...args);
}

async function api(path, body) {
  const res = await fetch(`${APP_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

// Nome do segmento: 2026-07-06_14-30-00-000000(.mp4) — hora local do PC.
function parseSegmentStart(fileName) {
  const m = fileName.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi, s);
}

async function processSegment(cameraId, filePath, fileStat) {
  const fileName = basename(filePath);
  log(`enviando ${cameraId}/${fileName} (${Math.round(fileStat.size / 1024)} KB)`);

  const signed = await api("/api/gateway/recordings/sign", { camera_id: cameraId });

  const body = await readFile(filePath);
  const put = await fetch(signed.upload_url, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4" },
    body,
  });
  if (!put.ok) throw new Error(`upload -> ${put.status} ${await put.text()}`);

  const startedAt = parseSegmentStart(fileName);
  const endedAt = fileStat.mtime;
  await api("/api/gateway/recordings/complete", {
    path: signed.path,
    camera_id: cameraId,
    appointment_id: signed.appointment_id,
    started_at: startedAt?.toISOString() ?? null,
    ended_at: endedAt.toISOString(),
    duration_sec: startedAt
      ? Math.max(Math.round((endedAt.getTime() - startedAt.getTime()) / 1000), 0)
      : null,
    size_bytes: fileStat.size,
  });

  await unlink(filePath);
  log(`concluído ${cameraId}/${fileName}`);
}

async function scan() {
  let dirs;
  try {
    dirs = await readdir(RECORDINGS_DIR, { withFileTypes: true });
  } catch {
    return; // pasta ainda não criada pelo MediaMTX
  }

  for (const dir of dirs) {
    // Só paths de atendimento (cam-<id>); paths de teste (test-*) são ignorados.
    if (!dir.isDirectory() || !dir.name.startsWith("cam-")) continue;
    const cameraId = dir.name.slice(4);
    const dirPath = join(RECORDINGS_DIR, dir.name);

    let files;
    try {
      files = await readdir(dirPath);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(".mp4")) continue;
      const filePath = join(dirPath, file);
      try {
        const s = await stat(filePath);
        if (Date.now() - s.mtimeMs < SETTLE_MS) continue; // ainda gravando
        await processSegment(cameraId, filePath, s);
      } catch (err) {
        log(`erro em ${file}: ${err.message} — tentará de novo no próximo ciclo`);
      }
    }

    // Remove diretórios vazios de atendimentos antigos (best-effort).
    try {
      await rmdir(dirPath);
    } catch {
      /* não vazio — ok */
    }
  }
}

log(`iniciado — observando ${RECORDINGS_DIR}, app ${APP_URL}`);
await scan();
setInterval(() => scan().catch((err) => log(`scan falhou: ${err.message}`)), SCAN_INTERVAL_MS);
