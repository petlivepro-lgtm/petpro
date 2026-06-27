import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Carrega o .env da raiz do monorepo como fonte única de variáveis.
// O Next só lê env da pasta do app; aqui injetamos as da raiz que ainda não
// existirem no ambiente (variáveis do SO/plataforma têm precedência).
const rootEnv = resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");
try {
  for (const line of readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // .env da raiz ausente — usa apenas o ambiente já existente.
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@mylivepet/ui", "@mylivepet/types"],
};

export default nextConfig;
