import type { JobDTO } from "../../../../packages/core/types.js";

type DeliveryStatus = "pending" | "sent" | "already_sent" | "disabled" | "not_configured" | "failed" | "skipped";
type DeliveryMap = Record<"discord" | "whatsapp", DeliveryStatus>;

type DeliveryChannel = {
  [key: string]: unknown;
  enabled?: boolean;
  client?: unknown;
  channelId?: string;
  groupId?: string;
  send?: (...args: any[]) => Promise<boolean>;
};

type DeliveryRepository = {
  createVaga: (job: JobDTO) => Promise<{ created: boolean; vaga: any }>;
  updateVagaStatus: (id: unknown, update: Record<string, boolean>) => Promise<unknown>;
};

const channelDisabled = (channel?: DeliveryChannel) => !channel?.enabled;

const channelReady = (channel: DeliveryChannel | undefined, required: string[] = []) =>
  required.every((key) => Boolean(channel?.[key])) && typeof channel?.send === "function";

const allEnabledChannelsDone = (delivery: DeliveryMap) =>
  Object.values(delivery).every((status) =>
    ["sent", "already_sent", "disabled", "not_configured"].includes(status)
  );

import { filterJuniorAndIntern } from "#root/services/vagaService.js";

export async function deliverJobCreated(
  job: JobDTO,
  {
    repository,
  }: {
    repository: DeliveryRepository;
  },
) {
  // 1. FILTRO SNIPER NA ENTRADA
  // Se não for Júnior/Estágio/Trainee, nem salvamos no banco para o lote.
  if (!filterJuniorAndIntern(job)) {
    console.log(`🚫 [delivery] Vaga ignorada pelo filtro Sniper (Sênior ou irrelevante): ${job.title}`);
    return {
      ok: true,
      status: "ignored_by_filter",
      delivery: { discord: "skipped", whatsapp: "skipped" }
    };
  }

  // 2. PERSISTÊNCIA
  const result = await repository.createVaga(job);
  const vaga = result.vaga;

  if (!vaga) {
    return {
      ok: false,
      status: "persistence_failed",
      delivery: { discord: "skipped", whatsapp: "skipped" }
    };
  }

  // 3. ENVIO IMEDIATO DESATIVADO
  // Agora o envio é feito exclusivamente pelo scheduler em 4 horários específicos.
  return {
    ok: true,
    status: result.created ? "created" : "already_exists",
    delivery: {
      discord: "pending_batch",
      whatsapp: "pending_batch"
    }
  };
}
