import {
  CalendarDays,
  CalendarPlus,
  Package,
  PackagePlus,
  PawPrint,
  Scissors,
  Settings,
  Sparkles,
  UserPlus,
  Users,
  UsersRound,
  Video,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mylivepet/types/database";
import {
  APPOINTMENT_STATUS_LABEL,
  MANAGEMENT_ROLES,
  formatBRL,
  type AppointmentStatus,
  type StaffRole,
} from "@mylivepet/types";
import { NAV_ITEMS } from "@/components/nav-items";
import { matchesCatalogSearch } from "@/lib/search-text";

/** Cada seção da paleta. A ordem aqui é a ordem na tela. */
export const SEARCH_GROUPS = [
  "pagina",
  "acao",
  "appointment",
  "pet",
  "tutor",
  "collaborator",
  "service",
  "product",
] as const;

export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export const GROUP_LABEL: Record<SearchGroup, string> = {
  pagina: "Páginas",
  acao: "Ações",
  appointment: "Atendimentos",
  pet: "Pets",
  tutor: "Tutores",
  collaborator: "Colaboradores",
  service: "Serviços",
  product: "Produtos",
};

export type SearchHit = {
  /** Único na lista inteira — vira a key do React e o alvo do teclado. */
  key: string;
  group: SearchGroup;
  title: string;
  subtitle?: string | null;
  /** Selo à direita: status do atendimento, estoque, "inativo"... */
  badge?: string | null;
  href: string;
  icon: LucideIcon;
};

const GROUP_ICON: Record<string, LucideIcon> = {
  appointment: CalendarDays,
  pet: PawPrint,
  tutor: Users,
  collaborator: UsersRound,
  service: Scissors,
  product: Package,
};

/**
 * Para onde o Enter leva cada tipo.
 *
 * Tutor, colaborador, serviço e produto não têm página própria: o destino é a
 * lista já filtrada pelo nome (`?q=`), que é o mais perto de "abrir o
 * registro" que existe hoje sem inventar quatro telas de detalhe.
 */
function hrefFor(kind: string, id: string, title: string): string | null {
  const q = `?q=${encodeURIComponent(title)}`;
  switch (kind) {
    case "appointment":
      return `/atendimentos/${id}`;
    case "pet":
      return `/pets/${id}`;
    case "tutor":
      return `/tutores${q}`;
    case "collaborator":
      return `/colaboradores${q}`;
    case "service":
      return `/servicos${q}`;
    case "product":
      return `/produtos${q}`;
    default:
      return null;
  }
}

// ---- Páginas e ações (resolvidas no navegador, sem ida ao banco) -----------

type StaticEntry = {
  label: string;
  href: string;
  icon: LucideIcon;
  group: Extract<SearchGroup, "pagina" | "acao">;
  roles: readonly StaffRole[];
  /** Sinônimos de quem procura pelo que a página faz, não pelo nome dela. */
  keywords?: string;
};

/** Telas que não estão no menu lateral mas são navegáveis. */
const EXTRA_PAGES: StaticEntry[] = [
  {
    label: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    group: "pagina",
    roles: MANAGEMENT_ROLES,
    keywords: "ajustes preferencias petshop dados",
  },
  {
    label: "Câmeras",
    href: "/configuracoes/cameras",
    icon: Video,
    group: "pagina",
    roles: MANAGEMENT_ROLES,
    keywords: "camera transmissao ao vivo configuracoes",
  },
  {
    label: "Pagamentos",
    href: "/configuracoes/pagamentos",
    icon: Wallet,
    group: "pagina",
    roles: MANAGEMENT_ROLES,
    keywords: "maquininha taxas terminal configuracoes",
  },
  {
    label: "Planos do Clubinho",
    href: "/configuracoes/clubinho",
    icon: Settings,
    group: "pagina",
    roles: MANAGEMENT_ROLES,
    keywords: "assinatura mensalidade plano configuracoes",
  },
];

/**
 * O que a paleta sabe criar.
 *
 * Cada uma abre a página de destino com `?novo=<slug>`, e o formulário de lá
 * se abre sozinho (ver `useOpenFromUrl`). É o que evita levantar os diálogos
 * de cadastro fora do lugar onde eles já sabem salvar.
 */
const ACTIONS: StaticEntry[] = [
  {
    label: "Novo agendamento",
    href: "/atendimentos?novo=agendamento",
    icon: CalendarPlus,
    group: "acao",
    roles: MANAGEMENT_ROLES,
    keywords: "criar marcar atendimento horario agenda adicionar",
  },
  {
    label: "Novo tutor",
    href: "/tutores?novo=tutor",
    icon: UserPlus,
    group: "acao",
    roles: MANAGEMENT_ROLES,
    keywords: "criar cadastrar cliente adicionar",
  },
  {
    label: "Novo serviço",
    href: "/servicos?novo=servico",
    icon: Scissors,
    group: "acao",
    roles: MANAGEMENT_ROLES,
    keywords: "criar cadastrar banho tosa adicionar catalogo",
  },
  {
    label: "Novo serviço adicional",
    href: "/servicos?novo=adicional",
    icon: Sparkles,
    group: "acao",
    roles: MANAGEMENT_ROLES,
    keywords: "criar cadastrar extra hidratacao perfume adicionar",
  },
  {
    label: "Novo produto",
    href: "/produtos?novo=produto",
    icon: PackagePlus,
    group: "acao",
    roles: MANAGEMENT_ROLES,
    keywords: "criar cadastrar estoque item adicionar",
  },
  {
    label: "Novo colaborador",
    href: "/colaboradores?novo=colaborador",
    icon: UserPlus,
    group: "acao",
    roles: MANAGEMENT_ROLES,
    keywords: "criar cadastrar funcionario equipe adicionar",
  },
];

function staticEntries(role: StaffRole | undefined): StaticEntry[] {
  if (!role) return [];
  const pages: StaticEntry[] = NAV_ITEMS.map((item) => ({
    label: item.label,
    href: item.href,
    icon: item.icon,
    group: "pagina" as const,
    roles: item.roles,
  }));
  return [...pages, ...EXTRA_PAGES, ...ACTIONS].filter((e) =>
    e.roles.includes(role),
  );
}

/** Páginas e ações que casam com o termo — instantâneo, sem rede. */
export function searchStatic(term: string, role?: StaffRole): SearchHit[] {
  const entries = staticEntries(role);
  const hits = term.trim()
    ? entries.filter((e) => matchesCatalogSearch([e.label, e.keywords], term))
    : // Sem termo a paleta mostra o que dá para fazer, não a lista inteira.
      entries.filter((e) => e.group === "acao");

  return hits.map((e) => ({
    key: `${e.group}:${e.href}`,
    group: e.group,
    title: e.label,
    href: e.href,
    icon: e.icon,
  }));
}

// ---- Registros (RPC global_search) ----------------------------------------

/** Menos que isso a RPC nem roda: dois caracteres casam com meio banco. */
export const MIN_SEARCH_LENGTH = 2;

export async function searchRecords(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  term: string,
  limit = 5,
): Promise<SearchHit[]> {
  const { data, error } = await supabase.rpc("global_search", {
    p_tenant: tenantId,
    p_query: term,
    p_limit: limit,
  });
  if (error || !data) return [];

  return data.flatMap((row): SearchHit[] => {
    const href = hrefFor(row.kind, row.id, row.title);
    if (!href || !SEARCH_GROUPS.includes(row.kind as SearchGroup)) return [];

    const price =
      row.amount_cents == null ? null : formatBRL(row.amount_cents);

    return [
      {
        key: `${row.kind}:${row.id}`,
        group: row.kind as SearchGroup,
        title: row.title,
        subtitle:
          [row.subtitle, price].filter(Boolean).join(" · ") || null,
        badge:
          row.kind === "appointment"
            ? (APPOINTMENT_STATUS_LABEL[row.extra as AppointmentStatus] ??
              row.extra)
            : row.extra,
        href,
        icon: GROUP_ICON[row.kind] ?? PawPrint,
      },
    ];
  });
}

/** Junta páginas, ações e registros na ordem das seções. */
export function groupHits(hits: SearchHit[]): [SearchGroup, SearchHit[]][] {
  return SEARCH_GROUPS.map(
    (group) =>
      [group, hits.filter((h) => h.group === group)] as [
        SearchGroup,
        SearchHit[],
      ],
  ).filter(([, list]) => list.length > 0);
}
