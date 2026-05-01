import { describe, expect, it, vi } from "vitest";
import { deliverJobCreated } from "./delivery.js";

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

const createRepository = ({ created = true, vaga = {} } = {}) => ({
  createVaga: vi.fn(async () => ({
    created,
    vaga: {
      _id: "vaga-1",
      sent_whatsapp: false,
      sent_discord: false,
      ...vaga
    }
  })),
  updateVagaStatus: vi.fn(async () => null)
});

describe("deliverJobCreated", () => {
  it("sends new jobs to Discord while WhatsApp is disabled", async () => {
    const repository = createRepository();
    const discordSend = vi.fn(async () => true);
    const whatsappSend = vi.fn(async () => true);

    const result = await deliverJobCreated(job, {
      repository,
      channels: {
        discord: {
          enabled: true,
          client: { id: "discord-client" },
          channelId: "discord-channel",
          send: discordSend
        },
        whatsapp: {
          enabled: false,
          groupId: "whatsapp-group",
          send: whatsappSend
        }
      }
    });

    expect(result).toEqual({
      ok: true,
      status: "created",
      delivery: {
        discord: "sent",
        whatsapp: "disabled"
      }
    });
    expect(discordSend).toHaveBeenCalledWith({ id: "discord-client" }, job, "discord-channel");
    expect(whatsappSend).not.toHaveBeenCalled();
    expect(repository.updateVagaStatus).toHaveBeenCalledWith("vaga-1", { sent_discord: true });
  });

  it("does not resend a job that was already delivered to all enabled channels", async () => {
    const repository = createRepository({
      created: false,
      vaga: {
        sent_discord: true,
        sent_whatsapp: false
      }
    });
    const discordSend = vi.fn(async () => true);

    const result = await deliverJobCreated(job, {
      repository,
      channels: {
        discord: {
          enabled: true,
          client: { id: "discord-client" },
          channelId: "discord-channel",
          send: discordSend
        },
        whatsapp: {
          enabled: false,
          groupId: undefined,
          send: vi.fn()
        }
      }
    });

    expect(result.status).toBe("already_processed");
    expect(result.delivery.discord).toBe("already_sent");
    expect(result.delivery.whatsapp).toBe("disabled");
    expect(discordSend).not.toHaveBeenCalled();
    expect(repository.updateVagaStatus).not.toHaveBeenCalled();
  });

  it("returns partial status when an enabled channel fails", async () => {
    const repository = createRepository();

    const result = await deliverJobCreated(job, {
      repository,
      channels: {
        discord: {
          enabled: true,
          client: { id: "discord-client" },
          channelId: "discord-channel",
          send: vi.fn(async () => false)
        },
        whatsapp: {
          enabled: false,
          groupId: undefined,
          send: vi.fn()
        }
      }
    });

    expect(result).toMatchObject({
      ok: false,
      status: "partial",
      delivery: {
        discord: "failed",
        whatsapp: "disabled"
      }
    });
    expect(repository.updateVagaStatus).not.toHaveBeenCalled();
  });
});
