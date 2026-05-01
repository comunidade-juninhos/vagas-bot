import { describe, expect, it } from "vitest";
import {
  createJobCreatedEvent,
  parseJobCreatedEvent
} from "./job-event.js";
import type { JobDTO } from "./types.js";

const job = (overrides: Partial<JobDTO> = {}): JobDTO => ({
  source: "gupy",
  externalId: "123",
  title: "Pessoa Desenvolvedora Backend",
  company: "Acme",
  location: "Remoto",
  workMode: "remote",
  seniority: "mid",
  url: "https://acme.gupy.io/job/123",
  description: "Node.js, TypeScript e MongoDB.",
  stack: ["node", "typescript"],
  scrapedAt: new Date("2026-04-30T12:00:00.000Z"),
  ...overrides
});

describe("job webhook events", () => {
  it("wraps a normalized job in the jobs.created event envelope", () => {
    const event = createJobCreatedEvent(job());

    expect(event).toMatchObject({
      event: "jobs.created",
      data: {
        job: {
          source: "gupy",
          title: "Pessoa Desenvolvedora Backend",
          url: "https://acme.gupy.io/job/123"
        }
      }
    });
  });

  it("parses a valid jobs.created payload from json", () => {
    const payload = JSON.parse(JSON.stringify(createJobCreatedEvent(job())));

    const event = parseJobCreatedEvent(payload);

    expect(event.event).toBe("jobs.created");
    expect(event.data.job.scrapedAt).toBeInstanceOf(Date);
  });

  it("accepts enriched notification fields while keeping old source payloads compatible", () => {
    const event = parseJobCreatedEvent({
      event: "jobs.created",
      data: {
        job: {
          source: "meupadrinho",
          title: "Cyber Security Engineer III",
          company: "Bradesco",
          location: "São Paulo, SP",
          workMode: "hybrid",
          seniority: "mid",
          url: "https://bradesco.gupy.io/jobs/123",
          description: "Atuação em CSIRT.",
          summary: "Atuação em CSIRT.",
          stack: ["cybersecurity", "siem"],
          salaryText: null,
          language: "pt",
          isInternational: false,
          scrapedAt: "2026-04-30T12:00:00.000Z"
        }
      }
    });

    expect(event.data.job.source).toBe("meupadrinho");
    expect(event.data.job.summary).toBe("Atuação em CSIRT.");
    expect(event.data.job.language).toBe("pt");
  });

  it("rejects payloads that are not jobs.created events", () => {
    expect(() =>
      parseJobCreatedEvent({
        event: "jobs.updated",
        data: { job: job() }
      })
    ).toThrow(/jobs\.created/);
  });

  it("rejects jobs without the required notification fields", () => {
    const invalid: unknown = {
      event: "jobs.created",
      data: {
        job: {
          source: "gupy",
          title: "Pessoa Desenvolvedora Backend"
        }
      }
    };

    expect(() => parseJobCreatedEvent(invalid)).toThrow(/url/);
  });
});
