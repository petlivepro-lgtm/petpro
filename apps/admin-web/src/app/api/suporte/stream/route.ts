import { requireAdminAction } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Uma conexão vive no máximo isto; o navegador reconecta e passa pelo guard de novo. */
const MAX_LIFE_MS = 10 * 60_000;
const HEARTBEAT_MS = 20_000;
const RECHECK_MS = 60_000;

type Row = { id?: string; ticket_id?: string } | null | undefined;

/**
 * Tempo real do suporte para o admin (Server-Sent Events).
 *
 * O admin não tem client Supabase no navegador. Este handler assina as
 * mudanças com a service role e repassa à página SÓ o tipo e o id do chamado
 * — nenhum texto. A página reage recarregando pelo servidor, onde cada
 * leitura passa por requireAdmin de novo.
 *
 * A sessão é reconferida a cada minuto: suspender um admin ou revogar a
 * sessão derruba o stream sem esperar ele cair sozinho.
 */
export async function GET(request: Request) {
  let admin;
  try {
    admin = await requireAdminAction();
  } catch {
    return new Response("Não autorizado", { status: 401 });
  }

  const svc = serviceClient();
  const encoder = new TextEncoder();
  let cleanup: () => void = () => undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const send = (event: string, data: Record<string, unknown>) =>
        write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const ticketOf = (table: string, row: Row) => (table === "support_ticket" ? row?.id : row?.ticket_id) ?? null;

      const channel = svc
        .channel(`admin-support-${admin.sessionId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "support_message" }, (p) =>
          send("change", { table: "support_message", ticket: ticketOf("support_message", (p.new as Row) ?? (p.old as Row)) }),
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "support_ticket" }, (p) =>
          send("change", { table: "support_ticket", ticket: ticketOf("support_ticket", (p.new as Row) ?? (p.old as Row)) }),
        )
        .subscribe((status) => send("status", { status }));

      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
      const recheck = setInterval(async () => {
        const { data } = await svc
          .from("platform_admin_session")
          .select("revoked_at")
          .eq("session_id", admin.sessionId)
          .maybeSingle<{ revoked_at: string | null }>();
        if (!data || data.revoked_at) close();
      }, RECHECK_MS);
      const maxLife = setTimeout(() => close(), MAX_LIFE_MS);

      function close() {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearInterval(recheck);
        clearTimeout(maxLife);
        void svc.removeChannel(channel);
        try {
          controller.close();
        } catch {
          // já fechado pelo navegador
        }
      }
      cleanup = close;

      // Reconexão em 3 s quando o servidor encerra (vida máxima, deploy).
      write("retry: 3000\n\n");
      request.signal.addEventListener("abort", close);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
