import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createJobCreatedEvent } from "../../../../packages/core/job-event.js";
import { createJobsWebhookRouter } from "./jobs.js";

const servers = [];

const job = {
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

async function createTestServer(router) {
  const app = express();
  app.use(express.json());
  app.use("/webhooks/jobs", router);

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });

  servers.push(server);
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
});

describe("jobs webhook", () => {
  it("rejects requests with an invalid webhook secret", async () => {
    const deliver = vi.fn();
    const baseUrl = await createTestServer(
      createJobsWebhookRouter({
        discordClient: null,
        webhookSecret: "secret",
        deliver
      })
    );

    const response = await fetch(`${baseUrl}/webhooks/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": "wrong"
      },
      body: JSON.stringify(createJobCreatedEvent(job))
    });

    expect(response.status).toBe(401);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("protects monitoring routes when a webhook secret is configured", async () => {
    const baseUrl = await createTestServer(
      createJobsWebhookRouter({
        discordClient: null,
        webhookSecret: "secret",
        deliver: vi.fn()
      })
    );

    const response = await fetch(`${baseUrl}/webhooks/jobs/stats`);

    expect(response.status).toBe(401);
  });

  it("delivers valid jobs.created events", async () => {
    const deliver = vi.fn(async () => ({
      ok: true,
      status: "created",
      delivery: {
        discord: "sent",
        whatsapp: "disabled"
      }
    }));
    const baseUrl = await createTestServer(
      createJobsWebhookRouter({
        discordClient: { id: "discord-client" },
        webhookSecret: "secret",
        deliver
      })
    );

    const response = await fetch(`${baseUrl}/webhooks/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": "secret"
      },
      body: JSON.stringify(createJobCreatedEvent(job))
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      status: "created",
      delivery: {
        discord: "sent",
        whatsapp: "disabled"
      }
    });
    expect(deliver).toHaveBeenCalledOnce();
    expect(deliver.mock.calls[0][0]).toMatchObject({
      title: "Pessoa Desenvolvedora Backend",
      url: "https://acme.gupy.io/job/123"
    });
  });
});
