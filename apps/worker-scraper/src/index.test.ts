import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobDTO } from "../../../packages/core/types.js";
import * as worker from "./index.js";

const job: JobDTO = {
  source: "gupy",
  externalId: "123",
  title: "Pessoa Desenvolvedora Backend",
  company: "Acme",
  location: "Remoto",
  workMode: "remote",
  seniority: "mid",
  url: "https://acme.gupy.io/job/123",
  description: "Node.js e TypeScript",
  stack: ["node", "typescript"],
  scrapedAt: new Date("2026-04-30T12:00:00.000Z")
};

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.WEBHOOK_URL;
  delete process.env.WEBHOOK_SECRET;
  delete process.env.PORT;
});

describe("sendJobCreatedWebhook", () => {
  it("does not accept a partial 202 delivery as sent", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({
        ok: false,
        status: "partial",
        delivery: { discord: "failed", whatsapp: "disabled" }
      }),
      { status: 202 }
    ));

    await expect(worker.sendJobCreatedWebhook(job, {
      fetchImpl,
      webhookUrl: "http://127.0.0.1:10000/webhooks/jobs",
      retries: 3,
      retryDelayMs: 1
    })).rejects.toThrow("webhook failed (202)");

    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("retries transient fetch failures before marking the job sent", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          ok: true,
          status: "created",
          delivery: { discord: "sent", whatsapp: "disabled" }
        }),
        { status: 200 }
      ));

    await expect(worker.sendJobCreatedWebhook(job, {
      fetchImpl,
      webhookUrl: "http://127.0.0.1:3000/webhooks/jobs",
      port: "10000",
      retries: 1,
      retryDelayMs: 1
    })).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe("http://127.0.0.1:10000/webhooks/jobs");
  });
});

describe("shouldRetryStoredJobDelivery", () => {
  it("retries stored jobs with an unsent enabled channel only", () => {
    expect(worker.shouldRetryStoredJobDelivery(
      { sent_discord: false, sent_whatsapp: false },
      { DISCORD_ENABLED: "true", WHATSAPP_ENABLED: "false" }
    )).toBe(true);

    expect(worker.shouldRetryStoredJobDelivery(
      { sent_discord: true, sent_whatsapp: false },
      { DISCORD_ENABLED: "true", WHATSAPP_ENABLED: "false" }
    )).toBe(false);

    expect(worker.shouldRetryStoredJobDelivery(
      { sent_discord: true, sent_whatsapp: false },
      { DISCORD_ENABLED: "true", WHATSAPP_ENABLED: "true" }
    )).toBe(true);
  });
});
