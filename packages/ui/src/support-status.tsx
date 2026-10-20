import * as React from "react";
import { SUPPORT_STATUS_LABEL, type SupportStatus } from "@mylivepet/types";
import { StatusChip } from "./status-chip";

const TONE = {
  NEW: "neutral",
  IN_PROGRESS: "info",
  WAITING_CUSTOMER: "brand",
  RESOLVED: "success",
  CLOSED: "neutral",
} as const satisfies Record<SupportStatus, string>;

/** Situação do chamado como o cliente (petshop ou tutor) a vê. */
export function SupportStatusChip({ status, className }: { status: SupportStatus; className?: string }) {
  return (
    <StatusChip tone={TONE[status]} className={className}>
      {SUPPORT_STATUS_LABEL[status]}
    </StatusChip>
  );
}
