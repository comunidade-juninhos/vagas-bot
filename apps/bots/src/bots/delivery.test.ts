import { describe, expect, it, vi } from "vitest";
import { deliverJobCreated } from "./delivery.js";

const job = {
  source: "gupy",
  externalId: "123",
  title: "Pessoa Desenvolvedora Backend",
  company: "Acme",
  location: "Remoto",
  workMode: "remote",
  seniority: "junior",
  url: "https://acme.gupy.io/job/123",
  description: "Node.js e TypeScript",
  stack: ["node", "typescript"],
  scrapedAt: new Date("2026-04-30T12:00:00.000Z")
};

const createRepository = ({ created = true, vaga = {} as any } = {}) => ({
  createVaga: vi.fn(async () => ({
    created,
    vaga: vaga === null ? null : {
      _id: "vaga-1",
      sent_whatsapp: false,
      sent_discord: false,
      ...vaga
    }
  })),
  updateVagaStatus: vi.fn(async () => null)
});

describe("deliverJobCreated", () => {
  it("persists new jobs and enqueues them for the batch digest", async () => {
    const repository = createRepository();

    const result = await deliverJobCreated(job, { repository });

    expect(result).toEqual({
      ok: true,
      status: "created",
      delivery: {
        discord: "pending_batch",
        whatsapp: "pending_batch"
      }
    });
    expect(repository.createVaga).toHaveBeenCalledWith(job);
  });

  it("returns already_exists for existing jobs and still enqueues them if not sent", async () => {
    const repository = createRepository({
      created: false,
      vaga: {
        sent_discord: false,
        sent_whatsapp: false
      }
    });

    const result = await deliverJobCreated(job, { repository });

    expect(result).toEqual({
      ok: true,
      status: "already_exists",
      delivery: {
        discord: "pending_batch",
        whatsapp: "pending_batch"
      }
    });
    expect(repository.createVaga).toHaveBeenCalledWith(job);
  });

  it("ignores jobs that do not pass the sniper filter", async () => {
    const repository = createRepository();
    const midJob = { ...job, seniority: "mid" };

    const result = await deliverJobCreated(midJob, { repository });

    expect(result).toEqual({
      ok: true,
      status: "ignored_by_filter",
      delivery: {
        discord: "skipped",
        whatsapp: "skipped"
      }
    });
    expect(repository.createVaga).not.toHaveBeenCalled();
  });

  it("returns persistence_failed when the repository fails to save/retrieve the job", async () => {
    const repository = createRepository({ vaga: null });

    const result = await deliverJobCreated(job, { repository });

    expect(result).toEqual({
      ok: false,
      status: "persistence_failed",
      delivery: {
        discord: "skipped",
        whatsapp: "skipped"
      }
    });
  });
});
