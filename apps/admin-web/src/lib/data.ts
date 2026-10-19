// Leituras da plataforma (service role). Toda função aqui pressupõe que quem
// chamou já passou por requireAdmin* — por isso o módulo é server-only e só é
// importado por páginas e actions que fazem o guard na primeira linha.
import "server-only";
import { serviceClient } from "@/lib/supabase/service";

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await serviceClient().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export type FeedEvent = {
  kind: string;
  tenant_id: string;
  tenant_name: string;
  at: string;
  text: string;
};

export type Overview = {
  days: number;
  tenants_total: number;
  tenants_active: number;
  tenants_new: number;
  tutors_total: number;
  tutors_app: number;
  tutors_new: number;
  appointments: number;
  appointments_prev: number;
  income_cents: number;
  cameras_total: number;
  gateways_total: number;
  gateways_online: number;
  live_now: number;
  mrr_cents: number;
  support_open: number;
  weekly_signups: { week: string; count: number }[];
  funnel: { signed_up: number; with_service: number; with_appointment: number; with_app_tutor: number };
  stalled_total: number;
  stalled: { id: string; name: string; address: string | null; last_activity: string; appointments_30d: number }[];
  feed: FeedEvent[];
};

export const getOverview = (days: number) => rpc<Overview>("admin_overview", { p_days: days });

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  address: string | null;
  owner_name: string | null;
  owner_email: string | null;
  last_activity: string;
  tutors: number;
  appointments_30d: number;
  cameras: number;
  gateway_seen_at: string | null;
  uses_clubinho: boolean;
  uses_delivery: boolean;
  uses_store: boolean;
  subscription_status: string | null;
  state: "active" | "stalled" | "new";
};

export type TenantList = {
  counts: { all: number; active: number; stalled: number; new: number };
  total: number;
  rows: TenantRow[];
};

export const getTenantList = (args: { search?: string; filter?: string; limit: number; offset: number }) =>
  rpc<TenantList>("admin_tenant_list", {
    p_search: args.search || null,
    p_filter: args.filter || "all",
    p_limit: args.limit,
    p_offset: args.offset,
  });

export type TenantDetail = {
  tenant: { id: string; name: string; slug: string; created_at: string; address: string | null; phone: string | null };
  last_activity: string;
  owner: { name: string | null; email: string | null; last_sign_in_at: string | null } | null;
  kpis: {
    tutors: number;
    tutors_app: number;
    pets: number;
    appointments_30d: number;
    income_30d_cents: number;
    clubinho_active: number;
    services: number;
    cameras: number;
  };
  modules: {
    appointments_30d: number;
    camera_sessions_30d: number;
    clubinho_active: number;
    delivery_routes_30d: number;
    reservations_30d: number;
    behavior_reports_30d: number;
  };
  team: { name: string | null; email: string | null; role: string; last_sign_in_at: string | null }[];
  gateway: { last_seen_at: string | null; created_at: string } | null;
  cameras: { id: string; room_label: string; active: boolean; live: boolean; last_session_at: string | null }[];
  subscription: {
    status: string;
    price_cents: number;
    cycle: string;
    plan: string | null;
    trial_ends_at: string | null;
    current_period_end: string | null;
  } | null;
  support_open: number;
  timeline: FeedEvent[];
};

export const getTenantDetail = (id: string) => rpc<TenantDetail | null>("admin_tenant_detail", { p_tenant: id });

export type TutorRow = {
  tutor_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  since: string;
  shops: string[];
  pets: number;
  last_sign_in_at: string | null;
  has_account: boolean;
};

export const getTutorList = (args: { search?: string; tenant?: string; app?: string; limit: number; offset: number }) =>
  rpc<{ total: number; rows: TutorRow[] }>("admin_tutor_list", {
    p_search: args.search || null,
    p_tenant: args.tenant || null,
    p_app: args.app || "all",
    p_limit: args.limit,
    p_offset: args.offset,
  });

export const revealTutorField = (tutorId: string, field: "phone" | "cpf" | "email") =>
  rpc<string | null>("admin_tutor_reveal", { p_tutor: tutorId, p_field: field });

export const accountEmail = (args: { tenant?: string | null; tutor?: string | null }) =>
  rpc<string | null>("admin_account_email", { p_tenant: args.tenant ?? null, p_tutor: args.tutor ?? null });

export const getActivityFeed = (args: { limit: number; tenant?: string; kind?: string; before?: string }) =>
  rpc<FeedEvent[]>("admin_activity_feed", {
    p_limit: args.limit,
    p_tenant: args.tenant || null,
    p_kind: args.kind || null,
    p_before: args.before || null,
  });

export type IdentityResult = {
  email: string;
  user: { created_at: string; last_sign_in_at: string | null; confirmed: boolean; mfa_factors: number } | null;
  memberships: { tenant_id: string; tenant_name: string; role: string; since: string }[];
  tutor_rows: { tutor_id: string; tenant_id: string; tenant_name: string; linked_account: boolean; since: string }[];
  admin: { role: string; status: string } | null;
};

export const lookupIdentity = (email: string) => rpc<IdentityResult>("admin_identity_lookup", { p_email: email });

export type CameraTenant = {
  id: string;
  name: string;
  last_seen_at: string | null;
  online: boolean | null;
  cameras: number;
  live_now: number;
  sessions_7d: number;
};

export const getCameraOverview = () => rpc<CameraTenant[]>("admin_camera_overview");

export type BillingOverview = {
  mrr_cents: number;
  active: number;
  trialing: number;
  trial_ending_7d: number;
  past_due: number;
  past_due_cents: number;
  cancelled_month: number;
  total: number;
  by_plan: { plan: string; count: number; mrr_cents: number }[];
  mrr_series: { month: string; mrr_cents: number }[];
  failed_recent: { tenant_name: string; amount_cents: number; due_date: string; reason: string | null }[];
  rows: {
    tenant_id: string;
    tenant_name: string;
    plan: string | null;
    price_cents: number;
    cycle: string;
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    payment_method: string | null;
    card_brand: string | null;
    card_last4: string | null;
    created_at: string;
  }[];
};

export const getBillingOverview = () => rpc<BillingOverview>("admin_billing_overview");

export type TenantOption = { id: string; name: string };

export async function getTenantOptions(): Promise<TenantOption[]> {
  const { data } = await serviceClient().from("tenant").select("id, name").order("name").limit(500);
  return (data ?? []) as TenantOption[];
}

export async function countNewTickets(): Promise<number> {
  const { count } = await serviceClient()
    .from("support_ticket")
    .select("id", { count: "exact", head: true })
    .eq("status", "NEW");
  return count ?? 0;
}

export type AdminNote = { id: string; body: string; author_name: string | null; created_at: string };

export async function getTenantNotes(tenantId: string): Promise<AdminNote[]> {
  const { data } = await serviceClient()
    .from("platform_admin_note")
    .select("id, body, author_name, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as AdminNote[];
}
