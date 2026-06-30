import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@mylivepet/types/database";

type CookieItem = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: "sb-mylivepet-tutor" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieItem[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
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
  const isAuthRoute = pathname.startsWith("/login");
  const isResetRoute = pathname.startsWith("/redefinir-senha");
  // 1º acesso via link mágico: a ficha de tutor ainda pode não estar vinculada
  // (o vínculo acontece no client, depois que o link autentica).
  const isFirstAccessRoute = pathname.startsWith("/criar-senha");
  const redirectWithSessionCookies = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  };

  if (!user && !isAuthRoute && !isFirstAccessRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user) {
    // Deixa a página de criar senha passar mesmo sem vínculo de tutor ainda:
    // o client roda claim_tutor_access logo após o link autenticar.
    if (isFirstAccessRoute) return response;

    const [{ data: tutor }, { data: membership }] = await Promise.all([
      supabase.from("tutor").select("id").eq("profile_id", user.id).limit(1).maybeSingle(),
      supabase
        .from("membership")
        .select("profile_id")
        .eq("profile_id", user.id)
        .limit(1)
        .maybeSingle(),
    ]);
    if (!tutor || membership) {
      await supabase.auth.signOut();
      if (!isAuthRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("erro", "acesso");
        return redirectWithSessionCookies(url);
      }
      return response;
    }

    if (isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    const mustReset = user.user_metadata?.must_reset_password === true;
    if (mustReset && !isResetRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/redefinir-senha";
      return NextResponse.redirect(url);
    }
    if (!mustReset && isResetRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
