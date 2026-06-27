/** Fallback instantâneo durante a navegação enquanto o RSC dinâmico resolve. */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 space-y-2">
        <div className="h-7 w-56 rounded-lg bg-graphite/10" />
        <div className="h-4 w-80 rounded bg-graphite/5" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-graphite/5" />
        ))}
      </div>
    </div>
  );
}
