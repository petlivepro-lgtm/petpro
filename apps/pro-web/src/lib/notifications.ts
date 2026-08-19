import type { Database } from "@mylivepet/types/database";

export type NotificationKind = Database["public"]["Enums"]["notification_kind"];

/**
 * Uma linha do sino. Vem pronta da RPC `list_notifications` (0040), que já
 * resolve o "lido" por pessoa e aplica o recorte de tenant/papel.
 */
export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  created_at: string;
  read: boolean;
};

/** Quantas notificações o sino carrega de uma vez. */
export const NOTIFICATION_PAGE_SIZE = 30;

export function unreadCount(items: NotificationItem[]): number {
  return items.reduce((n, item) => n + (item.read ? 0 : 1), 0);
}

/**
 * "agora", "há 5 min", "há 3 h", "ontem", "12/03" — o gestor só precisa saber
 * se o pedido é de agora ou de ontem; a data cheia fica na tela de destino.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000);

  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;

  return then.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
