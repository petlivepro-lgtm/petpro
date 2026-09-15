import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@mylivepet/types/database";

type CookieItem = { name: string; value: string; options?: CookieOptions };

/**
 * Onde cada papel de campo entra e as únicas rotas que ele pode abrir. A raiz
 * é comparada por igualdade, e não por prefixo: "/" casaria com tudo.
 *
 * Um mapa, e não duas constantes soltas: quando a 0062 acrescentou o
 * entregador ficou claro que "o papel restrito" nunca foi um só. Papel que não
 * está aqui é papel de gestão, e abre o painel inteiro.
 */
const FIELD_ACCESS: Record<string, { home: string; routes: string[] }> = {
  COLLABORATOR: { home: "/", routes: ["/atendimentos", "/pets"] },
  // O entregador só tem a rota do dia. As duas rotas de máquina são as
  // chamadas que o mapa dele faz (endereço → coordenada, e o traçado): sem
  // elas na lista, o fetch do próprio painel seria redirecionado para "/".
  DELIVERY: { home: "/", routes: ["/rota", "/api/geocode", "/api/rota"] },
};

function canOpen(access: { home: string; routes: string[] }, pathname: string): boolean {
  return (
    pathname === access.home ||
    access.routes.some((r) => pathname === r || pathname.startsWith(r + "/"))
  );
}

/** Atualiza a sessão (refresh de token) e protege rotas autenticadas. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: "sb-mylivepet-pro" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieItem[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicRoute =
    pathname.startsWith("/login") || pathname.startsWith("/cadastrar");
  // Destino do link de "esqueci minha senha". No primeiro request o token
  // ainda está só no fragmento da URL, invisível para o servidor — por isso a
  // rota passa sem sessão. E, depois que o client instala a sessão, ela também
  // não pode redirecionar para "/", senão o formulário some antes do uso.
  const isResetRoute = pathname.startsWith("/redefinir-senha");
  // Rotas de máquina com autenticação própria (JWKS público, Bearer do
  // gateway de câmeras, CRON_SECRET) — sem sessão de staff.
  const isMachineRoute =
    pathname.startsWith("/api/camera") ||
    pathname.startsWith("/api/gateway") ||
    pathname.startsWith("/api/cron");

  if (isMachineRoute) return response;

  const redirectWithSessionCookies = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);
    response.cookies
      .getAll()
      .forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  };

  if (!user && !isPublicRoute && !isResetRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    // A própria página valida o membership depois de instalar a sessão.
    if (isResetRoute) return response;

    const { data: membership } = await supabase
      .from("membership")
      .select("role")
      .eq("profile_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      await supabase.auth.signOut();
      if (!isPublicRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("erro", "acesso");
        return redirectWithSessionCookies(url);
      }
      return response;
    }

    const access = FIELD_ACCESS[membership.role];

    if (isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = access?.home ?? "/";
      return NextResponse.redirect(url);
    }

    // Quem é de campo enxerga só o próprio trabalho: o colaborador a agenda e
    // os pets que atende, o entregador a rota do dia. A RLS já barra o resto
    // no banco; isto evita que ele caia numa tela de gestão vazia.
    if (access && !canOpen(access, pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = access.home;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
