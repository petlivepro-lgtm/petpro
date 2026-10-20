import { createClient } from "@/lib/supabase/server";
import { readSupportAttachment } from "@/lib/support-attachment";

/**
 * Entrega o anexo de um chamado pela mesma origem do app: a miniatura na
 * conversa e o "Baixar" apontam para cá, e o link nunca expira na tela aberta.
 * Quem pode ver é decidido pela RLS da pessoa logada.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Anexo não encontrado.", { status: 404 });
  const file = await readSupportAttachment(await createClient(), id);
  if (!file) return new Response("Anexo não encontrado.", { status: 404 });

  const download = new URL(request.url).searchParams.has("download");
  const headers = new Headers({
    "Content-Type": file.mime,
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  // Imagem não roda nada; a CSP só garante isso se alguém abrir direto.
  if (file.mime.startsWith("image/")) headers.set("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  return new Response(file.blob, { headers });
}
