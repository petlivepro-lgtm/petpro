import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@mylivepet/types/database";
import { dispatchPendingPush } from "@mylivepet/notifications";
import { serviceClient } from "@/lib/supabase/service";
import { requiredEnv, supabaseUrl } from "@/lib/env";

export type TicketStatus = "NEW" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export const STATUS_LABEL: Record<TicketStatus, string> = {
  NEW: "Novo",
  IN_PROGRESS: "Em andamento",
  WAITING_CUSTOMER: "Aguardando cliente",
  RESOLVED: "Resolvido",
  CLOSED: "Encerrado",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  URGENT: "Urgente",
  HIGH: "Alta",
  NORMAL: "Normal",
  LOW: "Baixa",
};

export { SUPPORT_CATEGORY_LABEL as CATEGORY_LABEL } from "@mylivepet/types";

export const QUEUES = {
  novos: { label: "Novos", statuses: ["NEW"] as TicketStatus[] },
  meus: { label: "Meus", statuses: ["NEW", "IN_PROGRESS", "WAITING_CUSTOMER"] as TicketStatus[] },
  andamento: { label: "Em andamento", statuses: ["IN_PROGRESS"] as TicketStatus[] },
  aguardando: { label: "Aguardando cliente", statuses: ["WAITING_CUSTOMER"] as TicketStatus[] },
  resolvidos: { label: "Resolvidos", statuses: ["RESOLVED", "CLOSED"] as TicketStatus[] },
} as const;

export type QueueKey = keyof typeof QUEUES;

export type TicketListItem = {
  id: string;
  number: number;
  origin: "TENANT" | "TUTOR";
  tenant_id: string;
  opened_by_name: string | null;
  category: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  hidden_from_tenant: boolean;
  assigned_admin: string | null;
  first_response_due_at: string;
  first_response_at: string | null;
  created_at: string;
  tenant: { name: string } | null;
};

const LIST_COLUMNS =
  "id, number, origin, tenant_id, opened_by_name, category, subject, status, priority, hidden_from_tenant, assigned_admin, first_response_due_at, first_response_at, created_at, tenant:tenant_id (name)";

export async function listTickets(args: {
  queue: QueueKey;
  adminId: string;
  origin?: "TENANT" | "TUTOR";
  category?: string;
  tenant?: string;
}): Promise<TicketListItem[]> {
  let q = serviceClient()
    .from("support_ticket")
    .select(LIST_COLUMNS)
    .in("status", QUEUES[args.queue].statuses)
    .order("created_at", { ascending: args.queue !== "resolvidos" ? true : false })
    .limit(100);
  if (args.queue === "meus") q = q.eq("assigned_admin", args.adminId);
  if (args.origin) q = q.eq("origin", args.origin);
  if (args.category) q = q.eq("category", args.category);
  if (args.tenant) q = q.eq("tenant_id", args.tenant);
  const { data } = await q;
  return (data ?? []) as unknown as TicketListItem[];
}

export async function queueCounts(adminId: string): Promise<Record<QueueKey, number>> {
  const svc = serviceClient();
  const count = async (statuses: TicketStatus[], mine = false) => {
    let q = svc.from("support_ticket").select("id", { count: "exact", head: true }).in("status", statuses);
    if (mine) q = q.eq("assigned_admin", adminId);
    const { count: c } = await q;
    return c ?? 0;
  };
  const [novos, meus, andamento, aguardando, resolvidos] = await Promise.all([
    count(QUEUES.novos.statuses),
    count(QUEUES.meus.statuses, true),
    count(QUEUES.andamento.statuses),
    count(QUEUES.aguardando.statuses),
    count(QUEUES.resolvidos.statuses),
  ]);
  return { novos, meus, andamento, aguardando, resolvidos };
}

export type TicketMessage = {
  id: string;
  author_kind: "CUSTOMER" | "ADMIN" | "SYSTEM";
  author_name: string | null;
  body: string;
  internal: boolean;
  created_at: string;
};

export type TicketDetail = TicketListItem & {
  opened_by: string | null;
  opened_by_email: string | null;
  context: Record<string, string>;
  resolved_at: string | null;
  messages: TicketMessage[];
  attachments: { id: string; file_name: string; mime_type: string; size_bytes: number }[];
  previous: number;
  subscription: { status: string; plan: string | null } | null;
  gateway_seen_at: string | null;
  cameras: number;
};

export async function getTicket(id: string): Promise<TicketDetail | null> {
  const svc = serviceClient();
  const { data: t } = await svc
    .from("support_ticket")
    .select(`${LIST_COLUMNS}, opened_by, opened_by_email, context, resolved_at`)
    .eq("id", id)
    .maybeSingle();
  if (!t) return null;
  const ticket = t as unknown as TicketListItem & {
    opened_by: string | null;
    opened_by_email: string | null;
    context: Record<string, string>;
    resolved_at: string | null;
  };

  const [messages, attachments, previous, sub, gateway, cameras] = await Promise.all([
    svc
      .from("support_message")
      .select("id, author_kind, author_name, body, internal, created_at")
      .eq("ticket_id", id)
      .order("created_at"),
    svc.from("support_attachment").select("id, file_name, mime_type, size_bytes").eq("ticket_id", id),
    ticket.opened_by
      ? svc
          .from("support_ticket")
          .select("id", { count: "exact", head: true })
          .eq("opened_by", ticket.opened_by)
          .neq("id", id)
      : Promise.resolve({ count: 0 }),
    svc
      .from("tenant_subscription")
      .select("status, plan:plan_id (name)")
      .eq("tenant_id", ticket.tenant_id)
      .maybeSingle(),
    svc.from("camera_gateway").select("last_seen_at").eq("tenant_id", ticket.tenant_id).maybeSingle(),
    svc.from("camera").select("id", { count: "exact", head: true }).eq("tenant_id", ticket.tenant_id).eq("active", true),
  ]);

  const subRow = sub.data as unknown as { status: string; plan: { name: string } | null } | null;
  return {
    ...ticket,
    messages: (messages.data ?? []) as TicketMessage[],
    attachments: (attachments.data ?? []) as TicketDetail["attachments"],
    previous: previous.count ?? 0,
    subscription: subRow ? { status: subRow.status, plan: subRow.plan?.name ?? null } : null,
    gateway_seen_at: (gateway.data as { last_seen_at: string | null } | null)?.last_seen_at ?? null,
    cameras: cameras.count ?? 0,
  };
}

export async function listAssignableAdmins(): Promise<{ user_id: string; name: string }[]> {
  const { data } = await serviceClient()
    .from("platform_admin")
    .select("user_id, email, display_name")
    .eq("status", "active")
    .order("email");
  return ((data ?? []) as { user_id: string; email: string; display_name: string | null }[]).map((a) => ({
    user_id: a.user_id,
    name: a.display_name?.trim() || a.email,
  }));
}

/**
 * Avisa o cliente pelo sino (e push) que há novidade no chamado. Só o link
 * e o número: o texto da resposta fica no app, atrás do login.
 */
export async function notifyCustomer(
  ticket: Pick<TicketListItem, "id" | "number" | "origin" | "tenant_id"> & { opened_by: string | null },
  kind: "SUPPORT_REPLIED" | "SUPPORT_RESOLVED",
) {
  const typed = createClient<Database>(supabaseUrl(), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const isTutor = ticket.origin === "TUTOR";
  if (isTutor && !ticket.opened_by) return;
  const { error } = await typed.from("notification").insert({
    tenant_id: ticket.tenant_id,
    // Tutor: só ele. Petshop: o mural da gestão (sem destinatário).
    recipient_profile_id: isTutor ? ticket.opened_by : null,
    kind,
    title: kind === "SUPPORT_REPLIED" ? "O suporte do Pet Live Pro respondeu" : "Chamado resolvido",
    body:
      kind === "SUPPORT_REPLIED"
        ? `Seu chamado #${ticket.number} tem uma resposta nova.`
        : `O chamado #${ticket.number} foi marcado como resolvido.`,
    href: isTutor ? `/ajuda/${ticket.id}` : `/suporte/${ticket.id}`,
    meta: { support_ticket_id: ticket.id },
  });
  if (error) {
    console.error("[admin-web] aviso do suporte não gravado:", error.message);
    return;
  }
  await dispatchPendingPush(typed, ticket.tenant_id).catch(() => undefined);
}
