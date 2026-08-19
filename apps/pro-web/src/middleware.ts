import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // sw.js e manifest.webmanifest ficam de fora: o service worker precisa ser
  // servido na raiz sem passar pelo redirecionamento de sessão, senão o escopo
  // do push não cobre o painel inteiro.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:ico|svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
