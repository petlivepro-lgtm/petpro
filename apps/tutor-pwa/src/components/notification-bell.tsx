"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  BellRing,
  CalendarCheck,
  CalendarX2,
  PackageCheck,
  PackageX,
  PawPrint,
  X,
} from "lucide-react";
import {
  NotificationBell as UiNotificationBell,
  type IconComponent,
  type NotificationItem,
} from "@mylivepet/ui";
import { useRealtimeList } from "@/lib/use-realtime-list";
import {
  listNotifications,
  markNotificationsRead,
  savePushSubscription,
  removePushSubscription,
} from "@/app/(app)/notification-actions";

/**
 * O visual e a mecânica do popover moram em @mylivepet/ui, compartilhados com
 * o painel do petshop. Aqui ficam só as peças deste app: o realtime (que
 * depende do Supabase client daqui), as server actions e os ícones.
 *
 * Os kinds do petshop não aparecem para o tutor — a RLS não os entrega —, então
 * o mapa cobre só o que é endereçado a ele (0044).
 */
const ICONS: Record<string, IconComponent> = {
  BOOKING_CONFIRMED: CalendarCheck,
  BOOKING_REJECTED: CalendarX2,
  BOOKING_CANCELLED: CalendarX2,
  BOOKING_COMPLETED: PawPrint,
  RESERVATION_READY: PackageCheck,
  RESERVATION_REJECTED: PackageX,
};

export function NotificationBell({
  initial,
  channelName = "notificacoes",
}: {
  initial: NotificationItem[];
  channelName?: string;
}) {
  const router = useRouter();

  const fetcher = useCallback(() => listNotifications(), []);
  const items = useRealtimeList(
    initial,
    fetcher,
    [{ table: "notification" }, { table: "notification_read" }],
    channelName,
  );

  const openItem = useCallback(
    async (item: NotificationItem) => {
      if (!item.read) await markNotificationsRead([item.id]);
      if (item.href) router.push(item.href);
      else router.refresh();
    },
    [router],
  );

  const markAll = useCallback(async () => {
    await markNotificationsRead();
    router.refresh();
  }, [router]);

  return (
    <UiNotificationBell
      items={items}
      icons={ICONS}
      bellIcon={Bell}
      bellOffIcon={BellOff}
      bellRingIcon={BellRing}
      closeIcon={X}
      onOpenItem={openItem}
      onMarkAllRead={markAll}
      // O app do tutor troca de layout em lg, e não em md como o painel.
      desktopFrom={1024}
      emptyHint="Avisos do petshop sobre seus agendamentos e reservas aparecem aqui."
      enablePushLabel="Avisar neste aparelho mesmo com o app fechado"
      push={{
        vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        save: savePushSubscription,
        remove: removePushSubscription,
      }}
    />
  );
}
