import { requireAdminAction } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/service";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Anexo de chamado para a equipe: miniatura na conversa, imagem ampliada e
 * "Baixar". Mesma origem do admin, então o link não expira com a tela
 * aberta. Cada entrega que sai daqui fica na auditoria; o navegador guarda
 * a cópia por uma hora, e rever a mesma conversa não gera linha nova.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdminAction();
  } catch {
    return new Response("Não autorizado", { status: 401 });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Anexo não encontrado.", { status: 404 });

  const svc = serviceClient();
  const { data: att } = await svc
    .from("support_attachment")
    .select("id, ticket_id, storage_path, file_name, mime_type")
    .eq("id", id)
    .maybeSingle<{ id: string; ticket_id: string; storage_path: string; file_name: string; mime_type: string }>();
  if (!att) return new Response("Anexo não encontrado.", { status: 404 });
  const { data: blob } = await svc.storage.from("support").download(att.storage_path);
  if (!blob) return new Response("Não foi possível abrir o anexo.", { status: 502 });

  const download = new URL(request.url).searchParams.has("download");
  await writeAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "support.attachment_opened",
    resourceType: "support_attachment",
    resourceId: att.id,
  });

  const headers = new Headers({
    "Content-Type": att.mime_type,
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(att.file_name)}`,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  if (att.mime_type.startsWith("image/")) headers.set("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  return new Response(blob, { headers });
}
