import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@mylivepet/types/database";

type CookieItem = { name: string; value: string; options?: CookieOptions };

/**
 * Onde o colaborador entra e as únicas rotas que ele pode abrir. A raiz é
 * comparada por igualdade, e não por prefixo: "/" casaria com tudo.
 */
const COLLABORATOR_HOME = "/";
const COLLABORATOR_ROUTES = ["/atendimentos", "/pets"];

function isCollaboratorRoute(pathname: string): boolean {
  return pathname === "/" || COLLABORATOR_ROUTES.some((r) => pathname.startsWith(r));
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

    const isCollaborator = membership.role === "COLLABORATOR";

    if (isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = isCollaborator ? COLLABORATOR_HOME : "/";
      return NextResponse.redirect(url);
    }

    // O colaborador só enxerga a própria agenda e os pets que atende. A RLS já
    // barra o resto no banco; isto evita que ele caia numa tela de gestão vazia.
    if (isCollaborator && !isCollaboratorRoute(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = COLLABORATOR_HOME;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
