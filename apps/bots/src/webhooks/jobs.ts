import { Router } from "express";
import type { Request, Response } from "express";
import type { Client } from "discord.js";
import { ZodError } from "zod";
import crypto from "node:crypto";
import { parseJobCreatedEvent } from "../../../../packages/core/job-event.js";
import type { JobDTO } from "../../../../packages/core/types.js";
import { createVaga, updateVagaStatus, getVagas, getRecentVagas } from "#root/services/vagaService.js";
import { sendJob } from "../platforms/whatsapp.js";
import { sendJobDiscord } from "../platforms/discord.js";
import { config } from "../config/index.js";
import { deliverJobCreated } from "../bots/delivery.js";

type DeliverResult = {
  ok: boolean;
  status: string;
  delivery: Record<string, string>;
};

type DeliverFn = (
  job: JobDTO,
  args: {
    repository: {
      createVaga: typeof createVaga;
      updateVagaStatus: typeof updateVagaStatus;
    };
    channels: any;
  },
) => Promise<DeliverResult>;

export function isWebhookAuthorized(secret: string | undefined, headerValue: string | undefined) {
  if (!secret) return true;
  if (!headerValue) return false;
  
  try {
    const a = Buffer.from(secret);
    const b = Buffer.from(headerValue);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function createJobsWebhookRouter({
  discordClient,
  webhookSecret = config.webhook.secret,
  deliver = deliverJobCreated
}: {
  discordClient?: Client | null;
  webhookSecret?: string;
  deliver?: DeliverFn;
}) {
  const router = Router();

  // GET /webhooks/jobs — lista vagas recentes (útil para monitoramento)
  router.get("/", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
      const jobs = await getRecentVagas(limit);
      return res.json({
        ok: true,
        count: jobs.length,
        jobs: jobs.map((job) => ({
          id: job._id,
          source: job.source,
          title: job.title,
          company: job.company,
          workMode: job.workMode,
          seniority: job.seniority,
          stack: job.stack,
          url: job.url,
          sent_discord: job.sent_discord,
          sent_whatsapp: job.sent_whatsapp,
          publishedAt: job.publishedAt,
          createdAt: job.createdAt,
        })),
      });
    } catch (error) {
      console.error("❌ [jobs] erro ao listar vagas:", error instanceof Error ? error.message : String(error));
      return res.status(500).json({ ok: false, error: "failed to list jobs" });
    }
  });

  // GET /webhooks/jobs/stats — estatísticas rápidas
  router.get("/stats", async (_req: Request, res: Response) => {
    try {
      const result = await getVagas({}, { limit: 100, includeDescription: false });
      const jobs = result.items;

      const bySource: Record<string, number> = {};
      const bySeniority: Record<string, number> = {};
      const byWorkMode: Record<string, number> = {};
      let sentDiscord = 0;
      let sentWhatsapp = 0;

      for (const job of jobs) {
        bySource[job.source] = (bySource[job.source] || 0) + 1;
        bySeniority[job.seniority] = (bySeniority[job.seniority] || 0) + 1;
        byWorkMode[job.workMode] = (byWorkMode[job.workMode] || 0) + 1;
        if (job.sent_discord) sentDiscord += 1;
        if (job.sent_whatsapp) sentWhatsapp += 1;
      }

      return res.json({
        ok: true,
        total: jobs.length,
        hasMore: result.pagination.hasNextPage,
        bySource,
        bySeniority,
        byWorkMode,
        delivery: { discord: sentDiscord, whatsapp: sentWhatsapp },
      });
    } catch (error) {
      console.error("❌ [stats] erro ao gerar estatísticas:", error instanceof Error ? error.message : String(error));
      return res.status(500).json({ ok: false, error: "failed to generate stats" });
    }
  });

  // POST /webhooks/jobs — recebe webhook de nova vaga do scraper
  router.post("/", async (req: Request, res: Response) => {
    if (!isWebhookAuthorized(webhookSecret, req.get("x-webhook-secret"))) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    let event;
    try {
      event = parseJobCreatedEvent(req.body);
    } catch (error) {
      const details = error instanceof ZodError
        ? error.issues.map((issue) => issue.message)
        : [error instanceof Error ? error.message : String(error)];

      return res.status(400).json({
        ok: false,
        error: "invalid jobs.created payload",
        details
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
      console.error("❌ [jobs.created] erro ao processar vaga:", error instanceof Error ? error.message : String(error));
      return res.status(500).json({ ok: false, error: "job processing failed" });
    }
  });

  return router;
}
