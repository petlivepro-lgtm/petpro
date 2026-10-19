import Link from "next/link";
import type { FeedEvent } from "@/lib/data";
import { relative } from "@/lib/format";

const DOT: Record<string, string> = {
  TENANT_SIGNUP: "bg-orange",
  APPOINTMENT_COMPLETED: "bg-success",
  APPOINTMENT_CANCELLED: "bg-[#B5442F]",
  SUPPORT: "bg-warning",
};

export function ActivityList({ events, showTenant = true }: { events: FeedEvent[]; showTenant?: boolean }) {
  if (!events.length) {
    return <p className="py-6 text-center text-sm text-gray-neutral">Nenhum evento ainda.</p>;
  }
  return (
    <ol className="flex flex-col">
      {events.map((e, i) => (
        <li key={`${e.kind}-${e.at}-${i}`} className="flex gap-3 border-b border-graphite/[0.06] py-2.5 last:border-0">
          <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[e.kind] ?? "bg-petrol"}`} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm leading-snug">
              {showTenant ? (
                <>
                  <Link href={`/petshops/${e.tenant_id}`} className="font-semibold text-graphite hover:underline">
                    {e.tenant_name}
                  </Link>{" "}
                  {e.text}
                </>
              ) : (
                e.text.charAt(0).toUpperCase() + e.text.slice(1)
              )}
            </span>
            <span className="text-xs text-gray-neutral">{relative(e.at)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
