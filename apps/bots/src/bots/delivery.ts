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

export async function deliverJobCreated(
  job: JobDTO,
  {
    repository,
    channels,
  }: {
    repository: DeliveryRepository;
    channels: Record<"discord" | "whatsapp", DeliveryChannel>;
  },
) {
  const result = await repository.createVaga(job);
  const vaga = result.vaga;

  if (!vaga) {
    return {
      ok: false,
      status: "persistence_failed",
      delivery: {
        discord: "skipped",
        whatsapp: "skipped"
      }
    };
  }

  const delivery: DeliveryMap = {
    discord: channelDisabled(channels.discord) ? "disabled" : "pending",
    whatsapp: channelDisabled(channels.whatsapp) ? "disabled" : "pending"
  };

  if (delivery.discord === "pending" && vaga.sent_discord) {
    delivery.discord = "already_sent";
  }

  if (delivery.whatsapp === "pending" && vaga.sent_whatsapp) {
    delivery.whatsapp = "already_sent";
  }

  if (!result.created && allEnabledChannelsDone(delivery)) {
    return {
      ok: true,
      status: "already_processed",
      delivery
    };
  }

  if (delivery.discord === "pending") {
    if (!channelReady(channels.discord, ["client", "channelId"])) {
      delivery.discord = "not_configured";
    } else {
      const success = await channels.discord.send!(
        channels.discord.client,
        job,
        channels.discord.channelId
      );
      delivery.discord = success ? "sent" : "failed";

      if (success) {
        await repository.updateVagaStatus(vaga._id, { sent_discord: true });
      }
    }
  }

  if (delivery.whatsapp === "pending") {
    if (!channelReady(channels.whatsapp, ["groupId"])) {
      delivery.whatsapp = "not_configured";
    } else {
      const success = await channels.whatsapp.send!(job, channels.whatsapp.groupId);
      delivery.whatsapp = success ? "sent" : "failed";

      if (success) {
        await repository.updateVagaStatus(vaga._id, { sent_whatsapp: true });
      }
    }
  }

  const hasFailure = Object.values(delivery).includes("failed");

  return {
    ok: !hasFailure,
    status: hasFailure ? "partial" : result.created ? "created" : "retry",
    delivery
  };
}
