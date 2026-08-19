/**
 * Tipos e formatação do sino de notificações, compartilhados pelo painel do
 * petshop e pelo app do tutor. Sem React aqui de propósito — isto é usado
 * tanto no servidor (montagem inicial) quanto no cliente.
 */

/** Uma linha do sino, no formato que a RPC `list_notifications` devolve. */
export type NotificationItem = {
  id: string;
  /** Valor do enum notification_kind; cada app mapeia para o seu ícone. */
  kind: string;
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
 * "agora", "há 5 min", "há 3 h", "ontem", "12/03" — quem abre o sino só
 * precisa saber se é de agora ou de ontem; a data cheia está na tela de
 * destino.
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
