import { requireAdminAction } from "@/lib/auth";
import { getTenantList, getTutorList, suggestIdentity } from "@/lib/data";
import type { Suggestion } from "@/components/suggest-input";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIMIT = 6;

/**
 * Sugestões das buscas do admin enquanto se digita. Passa pelo mesmo guard das
 * actions e devolve só o que as próprias telas já mostram: dados de tutor e de
 * conta chegam mascarados do banco.
 */
export async function GET(request: Request) {
  try {
    await requireAdminAction();
  } catch {
    return Response.json({ items: [] }, { status: 401 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("tipo");
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) return Response.json({ items: [] });

  let items: Suggestion[] = [];
  if (kind === "petshops") {
    const list = await getTenantList({ search: q, filter: "all", limit: LIMIT, offset: 0 });
    items = list.rows.map((r) => ({
      href: `/petshops/${r.id}`,
      title: r.name,
      detail: [r.owner_name, r.owner_email, r.address].filter(Boolean).join(" · "),
      tags: [],
    }));
  } else if (kind === "tutores") {
    const list = await getTutorList({ search: q, limit: LIMIT, offset: 0 });
    items = list.rows.map((r) => ({
      href: `/tutores?${new URLSearchParams({ q: r.full_name, foco: r.tutor_id })}`,
      title: r.full_name,
      detail: [r.email, r.phone].filter(Boolean).join(" · "),
      tags: r.shops.slice(0, 2),
    }));
  } else if (kind === "identidade") {
    const list = await suggestIdentity(q, LIMIT + 2);
    items = list.map((r) => ({
      href: `/identidade?${new URLSearchParams({ [r.kind]: r.id })}`,
      title: r.name ?? r.email,
      detail: r.name ? r.email : "",
      tags: [r.admin && "Admin", r.staff && "Equipe de petshop", r.tutor && "Tutor"].filter(Boolean) as string[],
    }));
  } else {
    return Response.json({ items: [] }, { status: 400 });
  }
  return Response.json({ items });
}
