"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  BellRing,
  CalendarCheck,
  CalendarClock,
  CalendarSync,
  CalendarX2,
  PackagePlus,
  PackageX,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn, useScrollLock } from "@mylivepet/ui";
import { useRealtimeList } from "@/lib/use-realtime-list";
import {
  relativeTime,
  unreadCount,
  type NotificationItem,
  type NotificationKind,
} from "@/lib/notifications";
import {
  listNotifications,
  markNotificationsRead,
} from "@/app/(app)/notification-actions";
import { usePush } from "@/lib/use-push";

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  // Gestão
  BOOKING_REQUESTED: CalendarClock,
  BOOKING_CANCELLED: CalendarX2,
  RESERVATION_CREATED: PackagePlus,
  RESERVATION_CANCELLED: PackageX,
  RESERVATION_ITEM_CANCELLED: PackageX,
  FEEDBACK_RECEIVED: Star,
  // Colaborador (0042)
  APPOINTMENT_REQUESTED_FOR_ME: CalendarClock,
  APPOINTMENT_ASSIGNED: CalendarCheck,
  APPOINTMENT_CANCELLED_FOR_ME: CalendarX2,
  APPOINTMENT_RESCHEDULED: CalendarSync,
};

/**
 * O painel é popover ancorado no sino a partir de `md` e folha inferior no
 * celular. A escolha precisa existir em JS (e não só em classes) porque o
 * popover do desktop é posicionado por medida — é o mesmo motivo pelo qual
 * DatePicker e Select calculam `top/left` à mão.
 */
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return mobile;
}

const PANEL_WIDTH = 384; // md:w-96

export function NotificationBell({
  initial,
  // O sino existe em dois pontos de montagem (sidebar no desktop, barra no
  // celular) e só um deles está visível de cada vez. Cada um assina o seu
  // canal: dois canais de mesmo nome brigariam pela mesma inscrição.
  channelName = "notificacoes",
  emptyHint,
}: {
  initial: NotificationItem[];
  channelName?: string;
  /** O que a pessoa deve esperar ver aqui — muda entre gestão e colaborador. */
  emptyHint?: string;
}) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => setMounted(true), []);

  const fetcher = useCallback(() => listNotifications(), []);
  const items = useRealtimeList(
    initial,
    fetcher,
    // notification_read entra na lista para o contador zerar nas outras abas
    // e nos outros aparelhos de quem acabou de ler.
    [{ table: "notification" }, { table: "notification_read" }],
    channelName,
  );
  const unread = unreadCount(items);

  // Trava o scroll só quando o painel é folha inferior; no desktop o popover
  // acompanha o scroll em vez de bloqueá-lo.
  useScrollLock(open && isMobile);

  const updatePos = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const r = anchor.getBoundingClientRect();
    const margin = 8;
    // Alinhado à DIREITA do sino: o botão fica na borda direita da barra e um
    // painel alinhado à esquerda escaparia da tela.
    const left = Math.max(
      margin,
      Math.min(r.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - margin),
    );
    let top = r.bottom + margin;
    if (
      top + panel.offsetHeight > window.innerHeight - margin &&
      r.top - panel.offsetHeight - margin > 0
    ) {
      top = r.top - panel.offsetHeight - margin;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - panel.offsetHeight - margin));
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open || isMobile) return;
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open, isMobile, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Não fecha o drawer do menu que possa estar em volta.
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    setOpen((o) => {
      if (!o) setPos(null);
      return !o;
    });
  }

  async function openItem(item: NotificationItem) {
    setOpen(false);
    if (!item.read) await markNotificationsRead([item.id]);
    if (item.href) router.push(item.href);
    else router.refresh();
  }

  async function markAll() {
    await markNotificationsRead();
    router.refresh();
  }

  const panel = (
    <>
      {/* Fundo escurecido só na folha inferior; no desktop o clique fora basta. */}
      {isMobile && (
        <div
          className="fixed inset-0 z-[95] bg-graphite/50"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notificações"
        style={
          isMobile
            ? undefined
            : {
                position: "fixed",
                top: pos?.top ?? 0,
                left: pos?.left ?? 0,
                width: PANEL_WIDTH,
                visibility: pos ? "visible" : "hidden",
              }
        }
        className={cn(
          "z-[100] flex flex-col overflow-hidden border border-graphite/10 bg-surface shadow-card-hover",
          isMobile
            ? "fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl"
            : "max-h-[70vh] rounded-2xl",
        )}
      >
        <header className="flex items-center justify-between border-b border-graphite/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="font-medium text-graphite">Notificações</p>
            {unread > 0 && (
              <span className="rounded-full bg-orange/10 px-2 py-0.5 text-xs font-medium text-orange">
                {unread} nova{unread > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="rounded-lg px-2 py-1 text-xs font-medium text-petrol hover:bg-surface-muted"
              >
                Marcar todas
              </button>
            )}
            <button
              type="button"
              aria-label="Fechar notificações"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-graphite/60 hover:bg-surface-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {items.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Bell className="mx-auto mb-3 h-8 w-8 text-graphite/20" />
              <p className="text-sm font-medium text-graphite">Nada por aqui ainda</p>
              <p className="mt-1 text-xs text-gray-neutral">
                {emptyHint ??
                  "Pedidos de serviço e reservas dos tutores aparecem aqui assim que chegam."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-graphite/5">
              {items.map((item) => {
                const Icon = KIND_ICON[item.kind] ?? Bell;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted",
                        !item.read && "bg-orange/[0.04]",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          item.read
                            ? "bg-surface-muted text-gray-neutral"
                            : "bg-orange/10 text-orange",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-sm text-graphite",
                              item.read ? "font-normal" : "font-medium",
                            )}
                          >
                            {item.title}
                          </span>
                          <span className="shrink-0 text-xs text-gray-neutral">
                            {relativeTime(item.created_at)}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-gray-neutral">
                          {item.body}
                        </span>
                      </span>
                      {!item.read && (
                        <span
                          className="mt-2 h-2 w-2 shrink-0 rounded-full bg-orange"
                          aria-label="Não lida"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <PushFooter />
      </div>
    </>
  );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : "Notificações"}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-graphite transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex min-w-[1.125rem] items-center justify-center rounded-full bg-orange px-1 text-[0.625rem] font-semibold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {mounted && open && createPortal(panel, document.body)}
    </>
  );
}

/**
 * Rodapé do painel: liga o aviso do navegador. Fica aqui, e não escondido nas
 * configurações, porque é onde o gestor percebe que existe — e o navegador só
 * aceita o pedido de permissão a partir de um clique dele.
 */
function PushFooter() {
  const { state, busy, error, enable, disable } = usePush();

  if (state === "checking") return null;

  const base =
    "flex w-full items-center gap-2 border-t border-graphite/10 px-4 py-3 text-left text-sm";

  if (state === "unsupported") {
    return (
      <p className={cn(base, "text-xs text-gray-neutral")}>
        <BellOff className="h-4 w-4 shrink-0" />
        Este navegador não recebe avisos. No iPhone, adicione o painel à tela de
        início primeiro.
      </p>
    );
  }

  if (state === "blocked") {
    return (
      <p className={cn(base, "text-xs text-gray-neutral")}>
        <BellOff className="h-4 w-4 shrink-0" />
        Avisos bloqueados para este site. Libere nas permissões do navegador
        para voltar a receber.
      </p>
    );
  }

  if (state === "on") {
    return (
      <div className="border-t border-graphite/10">
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-graphite">
          <BellRing className="h-4 w-4 shrink-0 text-success" />
          <span className="flex-1">Avisos ligados neste aparelho</span>
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="rounded-lg px-2 py-1 text-xs font-medium text-gray-neutral hover:bg-surface-muted disabled:opacity-50"
          >
            Desligar
          </button>
        </div>
        {error && <p className="px-4 pb-3 text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="border-t border-graphite/10">
      <button
        type="button"
        onClick={enable}
        disabled={busy}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-orange transition-colors hover:bg-orange/5 disabled:opacity-50"
      >
        <BellRing className="h-4 w-4 shrink-0" />
        {busy ? "Ativando..." : "Avisar neste aparelho mesmo com o painel fechado"}
      </button>
      {error && <p className="px-4 pb-3 text-xs text-danger">{error}</p>}
    </div>
  );
}
