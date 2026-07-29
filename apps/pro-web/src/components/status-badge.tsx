import { Badge } from "@mylivepet/ui";
import {
  APPOINTMENT_STATUS_LABEL,
  RESERVATION_STATUS_LABEL,
  type AppointmentStatus,
  type ReservationStatus,
} from "@mylivepet/types";

const apptTone: Record<
  AppointmentStatus,
  React.ComponentProps<typeof Badge>["tone"]
> = {
  REQUESTED: "warning",
  CONFIRMED: "info",
  CHECKED_IN: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export function AppointmentStatusBadge({
  status,
}: {
  status: AppointmentStatus;
}) {
  return (
    <Badge tone={apptTone[status]}>{APPOINTMENT_STATUS_LABEL[status]}</Badge>
  );
}

const resvTone: Record<
  ReservationStatus,
  React.ComponentProps<typeof Badge>["tone"]
> = {
  RESERVED: "warning",
  PICKED: "info",
  COMPLETED: "success",
  PARTIALLY_REFUNDED: "warning",
  REFUNDED: "danger",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
  REJECTED: "danger",
};

export function ReservationStatusBadge({
  status,
}: {
  status: ReservationStatus;
}) {
  return (
    <Badge tone={resvTone[status]}>{RESERVATION_STATUS_LABEL[status]}</Badge>
  );
}
