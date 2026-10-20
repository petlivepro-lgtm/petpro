import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { adminCookieOptions, clampCookie } from "@/lib/supabase/cookies";

/**
 * Conveniência, não fronteira: renova o token, manda quem não tem sessão para
 * o login e monta a CSP com nonce. Quem decide se a pessoa É admin, com qual
 * papel e se passou pelo MFA é requireAdmin* (lib/auth.ts), chamado em toda
 * página e action — se este arquivo fosse contornado, nada abriria.
 */
const isProd = process.env.NODE_ENV === "production";

function contentSecurityPolicy(nonce: string) {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? "" : " 'unsafe-eval'"}`,
    // Atributos style= dos componentes compartilhados exigem inline.
    "style-src 'self' 'unsafe-inline'",
    // data: para o QR Code do MFA (o Supabase devolve SVG em data URI).
    `img-src 'self' data: blob: ${supabase}`,
    "font-src 'self'",
    `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
    // Service worker do push (public/sw.js). Sem isto o 'strict-dynamic' do
    // script-src, que vale de fallback, bloquearia o registro.
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

const PUBLIC_PATHS = ["/login", "/ativar"];

export async function middleware(request: NextRequest) {
  // Edge runtime: sem Buffer, btoa resolve.
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);

  // O Next lê o nonce deste cabeçalho da request e o aplica nos scripts dele.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: adminCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
          response = NextResponse.next({ request: { headers: requestHeaders } });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, clampCookie(options)),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  // Anexo do suporte é arquivo, não página: a rota define a CSP dele (imagem)
  // e o PDF precisa abrir no visualizador do navegador, que object-src 'none'
  // bloqueia.
  if (!pathname.startsWith("/api/suporte/anexo/")) response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // sw.js fica de fora: o navegador busca atualização do service worker sem
    // garantia de sessão, e um redirect para /login quebraria o push.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sw.js|brand/).*)",
  ],
};
