/** Largura e respiro laterais de todas as seções. */
export const WRAP = "mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-[72px]";

/** Título de seção em duas cores: primeira frase em grafite, complemento em laranja. */
export function SectionTitle({
  id,
  lead,
  accent,
  className = "",
  as: Tag = "h2",
}: {
  id: string;
  lead: string;
  accent: string;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <Tag
      id={id}
      className={`font-heading font-extrabold tracking-[-0.03em] text-graphite [text-wrap:balance] ${className}`}
    >
      {lead} <span className="title-accent">{accent}</span>
    </Tag>
  );
}
