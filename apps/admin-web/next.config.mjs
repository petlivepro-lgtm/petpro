import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Carrega o .env da raiz do monorepo como fonte única de variáveis (mesmo
// esquema do pro-web): variáveis do SO/plataforma têm precedência.
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

const isProd = process.env.NODE_ENV === "production";

// A CSP sai do middleware (precisa de nonce por request). Aqui ficam os
// cabeçalhos fixos, que valem para toda resposta do admin.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@mylivepet/ui", "@mylivepet/types", "@mylivepet/notifications"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Nada do admin pode ficar em cache de navegador ou de proxy.
      {
        source: "/((?!_next/static|_next/image|brand).*)",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
