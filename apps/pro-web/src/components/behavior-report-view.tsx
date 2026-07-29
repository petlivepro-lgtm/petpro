import { EmptyState, RatingStars, StatusChip } from "@mylivepet/ui";
import {
  BEHAVIOR_BADGE_LABEL,
  BEHAVIOR_BADGE_TONE,
  BEHAVIOR_MIN_REPORTS,
  behaviorBadgeOf,
  formatBehaviorScore,
  groupBehaviorByMonth,
  type BehaviorReportRow,
} from "@mylivepet/types";
import { PawPrint } from "lucide-react";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Um boletim: notas por categoria + observação da equipe. */
export function BehaviorReportDetail({
  report,
  showDate = false,
}: {
  report: BehaviorReportRow;
  showDate?: boolean;
}) {
  return (
    <div className="space-y-3">
      {showDate && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-graphite">
            {fmtDate(report.createdAt)}
            {report.serviceName && (
              <span className="font-normal text-gray-neutral">
                {" "}
                · {report.serviceName}
              </span>
            )}
          </p>
          {report.overallScore !== null && (
            <span className="text-sm text-gray-neutral">
              Média{" "}
              <strong className="text-graphite">
                {formatBehaviorScore(report.overallScore)}
              </strong>
            </span>
          )}
        </div>
      )}

      {report.responses.length > 0 && (
        <div className="space-y-1.5">
          {report.responses.map((r) => (
            <div
              key={r.category_id}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span className="text-sm text-gray-neutral">
                {r.label}
                {/* A nota crua é o que a equipe marcou; a inversão só vale para a média. */}
                {r.inverted && (
                  <span className="ml-1 text-xs text-gray-neutral/70">
                    (nota alta = ruim)
                  </span>
                )}
              </span>
              <RatingStars value={r.value} size="sm" />
            </div>
          ))}
        </div>
      )}

      {report.note && (
        <p className="rounded-xl bg-surface-muted p-3 text-sm text-gray-neutral">
          {report.note}
        </p>
      )}
    </div>
  );
}

/** Histórico do boletim agrupado por mês, do mais recente para o mais antigo. */
export function BehaviorReportView({
  reports,
}: {
  reports: BehaviorReportRow[];
}) {
  if (reports.length === 0) {
    return (
      <EmptyState
        icon={<PawPrint className="h-6 w-6" />}
        title="Ainda sem boletim"
        description={`A equipe avalia o comportamento ao finalizar cada atendimento. O selo aparece a partir de ${BEHAVIOR_MIN_REPORTS} avaliações.`}
      />
    );
  }

  const months = groupBehaviorByMonth(reports);

  return (
    <div className="space-y-5">
      {months.map((month) => {
        const badge = behaviorBadgeOf(month.average, month.count);
        return (
          <div
            key={month.key}
            className="rounded-2xl border border-graphite/5 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-heading font-semibold text-graphite">
                {month.label}
              </h3>
              <div className="flex items-center gap-2">
                {month.average !== null && (
                  <>
                    <RatingStars value={Math.round(month.average)} size="sm" />
                    <span className="text-sm text-gray-neutral">
                      {formatBehaviorScore(month.average)} · {month.count}{" "}
                      {month.count === 1 ? "avaliação" : "avaliações"}
                    </span>
                  </>
                )}
                {badge && (
                  <StatusChip tone={BEHAVIOR_BADGE_TONE[badge]}>
                    {BEHAVIOR_BADGE_LABEL[badge]}
                  </StatusChip>
                )}
              </div>
            </div>

            {month.categories.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-graphite/5 pt-3">
                {month.categories.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="text-sm text-gray-neutral">{c.label}</span>
                    <div className="flex items-center gap-2">
                      <RatingStars value={Math.round(c.average)} size="sm" />
                      <span className="w-8 text-right text-xs text-gray-neutral">
                        {formatBehaviorScore(c.average)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 space-y-3 border-t border-graphite/5 pt-3">
              {month.reports.map((r) => (
                <div key={r.id} className="text-sm">
                  <p className="text-xs text-gray-neutral">
                    {fmtDate(r.createdAt)}
                    {r.serviceName && ` · ${r.serviceName}`}
                    {r.overallScore !== null &&
                      ` · média ${formatBehaviorScore(r.overallScore)}`}
                  </p>
                  {r.note && (
                    <p className="mt-1 text-gray-neutral">{r.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
