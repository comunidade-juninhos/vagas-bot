import { Router } from "express";
import { parseJobCreatedEvent } from "../../../../packages/core/job-event.js";
import { createVaga, updateVagaStatus } from "#root/services/vagaService.js";
import { sendJob } from "../platforms/whatsapp.js";
import { sendJobDiscord } from "../platforms/discord.js";
import { config } from "../config/index.js";
import { deliverJobCreated } from "../bots/delivery.js";

export function isWebhookAuthorized(secret, headerValue) {
  if (!secret) return true;
  return headerValue === secret;
}

export function createJobsWebhookRouter({
  discordClient,
  webhookSecret = config.webhook.secret,
  deliver = deliverJobCreated
}) {
  const router = Router();

  router.post("/", async (req, res) => {
    if (!isWebhookAuthorized(webhookSecret, req.get("x-webhook-secret"))) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    let event;
    try {
      event = parseJobCreatedEvent(req.body);
    } catch (error) {
      return res.status(400).json({
        ok: false,
        error: "invalid jobs.created payload",
        details: error?.issues?.map((issue) => issue.message) ?? [error.message]
      });
    }

    const job = event.data.job;
    console.log(`📩 [jobs.created] recebida: ${job.title}`);

    try {
      const result = await deliver(job, {
        repository: {
          createVaga,
          updateVagaStatus
        },
        channels: {
          discord: {
            enabled: config.discord.enabled,
            client: discordClient,
            channelId: config.discord.channelId,
            send: sendJobDiscord
          },
          whatsapp: {
            enabled: config.whatsapp.enabled,
            groupId: config.whatsapp.groupId,
            send: sendJob
          }
        }
      });

      const httpStatus = result.status === "persistence_failed" ? 500 : result.ok ? 200 : 202;
      return res.status(httpStatus).json(result);
    } catch (error) {
      console.error("❌ [jobs.created] erro ao processar vaga:", error.message);
      return res.status(500).json({ ok: false, error: "job processing failed" });
    }
  });

  return router;
}
