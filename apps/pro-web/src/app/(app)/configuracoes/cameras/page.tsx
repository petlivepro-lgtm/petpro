import { Video } from "lucide-react";
import { Card, PageHeader, StatusChip, EmptyState } from "@mylivepet/ui";
import { DEFAULT_RECORDING_RETENTION_DAYS } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveTenant } from "@/lib/tenant";
import { CameraDialog } from "./camera-dialog";
import { DeleteCameraDialog } from "./delete-camera-dialog";
import { TestCameraButton } from "./test-camera-button";
import { GatewayCard } from "./gateway-card";
import { RetentionForm } from "./retention-form";

export default async function CamerasPage() {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return null;

  const { data: cameras } = await supabase
    .from("camera")
    .select("id, room_label, host, port, stream_path, username, active")
    .order("room_label");

  // Gateway e settings ficam fora do alcance do RLS do cliente — via service role.
  const admin = createAdminClient();
  const [{ data: gateway }, { data: tenantRow }] = await Promise.all([
    admin
      .from("camera_gateway")
      .select("tunnel_url, api_tunnel_url, last_seen_at")
      .eq("tenant_id", tenant.tenantId)
      .maybeSingle(),
    admin.from("tenant").select("settings").eq("id", tenant.tenantId).maybeSingle(),
  ]);

  const settings = (tenantRow?.settings ?? {}) as { recordings_retention_days?: number };
  const retentionDays = settings.recordings_retention_days ?? DEFAULT_RECORDING_RETENTION_DAYS;
  const list = cameras ?? [];

  return (
    <div>
      <PageHeader
        title="Câmeras"
        subtitle="Transmissão ao vivo do atendimento para o tutor e gravações."
        actions={<CameraDialog />}
      />

      <div className="space-y-6">
        <GatewayCard
          gateway={
            gateway
              ? { tunnelUrl: gateway.tunnel_url, apiTunnelUrl: gateway.api_tunnel_url, lastSeenAt: gateway.last_seen_at }
              : null
          }
        />

        <RetentionForm days={retentionDays} />

        {list.length === 0 ? (
          <EmptyState
            icon={<Video className="h-6 w-6" />}
            title="Nenhuma câmera cadastrada"
            description="Cadastre uma câmera por sala de atendimento. Ao iniciar um serviço, você escolhe a sala e o tutor passa a assistir ao vivo."
            action={<CameraDialog />}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => (
              <Card key={c.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-heading font-semibold text-graphite">{c.room_label}</p>
                    <p className="text-sm text-gray-neutral">
                      {c.host}:{c.port}/{c.stream_path}
                    </p>
                  </div>
                  <StatusChip tone={c.active ? "success" : "danger"}>
                    {c.active ? "Ativa" : "Inativa"}
                  </StatusChip>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-graphite/5 pt-3">
                  <TestCameraButton cameraId={c.id} />
                  <div className="flex items-center gap-1">
                    <CameraDialog
                      camera={{
                        id: c.id,
                        room_label: c.room_label,
                        host: c.host ?? "",
                        port: c.port,
                        stream_path: c.stream_path,
                        username: c.username ?? "",
                        active: c.active,
                      }}
                    />
                    <DeleteCameraDialog cameraId={c.id} roomLabel={c.room_label} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
