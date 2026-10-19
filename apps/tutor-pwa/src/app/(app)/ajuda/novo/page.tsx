import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TUTOR_APP_TOPICS } from "@mylivepet/types";
import { TutorTicketForm } from "./ticket-form";

export default async function NovoChamadoPage({ searchParams }: { searchParams: Promise<{ assunto?: string }> }) {
  const { assunto } = await searchParams;
  const sensitive = assunto === "PETSHOP_REPORT";
  const topic = sensitive
    ? { value: "PETSHOP_REPORT", label: "Algo grave aconteceu com meu pet" }
    : TUTOR_APP_TOPICS.find((t) => t.value === assunto);
  if (!topic) notFound();

  return (
    <div className="space-y-5 lg:max-w-2xl">
      <Link href="/ajuda" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-graphite/70 hover:text-graphite">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Ajuda
      </Link>
      <header className="space-y-2">
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Falar com o Pet Live Pro</h1>
        <span
          className={`inline-flex rounded-full px-3 py-1.5 text-sm font-bold ${sensitive ? "bg-danger/10 text-danger" : "bg-orange/10 text-orange"}`}
        >
          {topic.label}
        </span>
      </header>
      <TutorTicketForm topic={topic.value} sensitive={sensitive} />
    </div>
  );
}
