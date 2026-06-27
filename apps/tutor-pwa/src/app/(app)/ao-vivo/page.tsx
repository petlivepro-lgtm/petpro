import { Card } from "@mylivepet/ui";

export default function AoVivoPage() {
  return (
    <div className="space-y-5 lg:max-w-3xl">
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Ao vivo</h1>
        <p className="text-sm text-gray-neutral">
          Acompanhe o atendimento do seu pet com segurança e tranquilidade.
        </p>
      </header>

      <Card className="flex aspect-video items-center justify-center bg-graphite text-center">
        <div className="px-6">
          <div className="text-3xl">📹</div>
          <p className="mt-2 font-heading font-semibold text-white">Transmissão em breve</p>
          <p className="mt-1 text-sm text-gray-soft/80">
            A câmera ao vivo entra na Fase 2 (WebRTC + gravações). Disponível quando o
            atendimento do seu pet começar.
          </p>
        </div>
      </Card>

      <p className="text-center text-xs text-gray-neutral">
        A transmissão respeita consentimento, finalidade e acesso controlado (LGPD).
      </p>
    </div>
  );
}
