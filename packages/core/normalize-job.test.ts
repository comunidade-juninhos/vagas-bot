import { describe, expect, it } from "vitest";
import { normalizeRemotarJob } from "../sources/remotar/remotar.parser.js";

const baseJob = {
  id: 123,
  title: "Desenvolvedor Front-end React TypeScript Júnior",
  subtitle: "React and TypeScript role",
  description: "<p>Crie interfaces em <strong>React</strong>.</p><ul><li>TypeScript</li></ul>",
  type: "remote",
  city: null,
  state: null,
  externalLink: "https://example.com/apply",
  createdAt: "2026-04-27T10:00:00.000-03:00",
  country: { name: "Brasil" },
  company: { name: "Acme" },
  jobTags: [{ tag: { name: "🌍 100% Remoto" } }, { tag: { name: "🐥 Júnior" } }],
  jobCategories: [{ category: { name: "Desenvolvimento / Programação" } }]
};

describe("normalizeRemotarJob", () => {
  it("normalizes a Remotar job into the shared job shape", () => {
    const job = normalizeRemotarJob(baseJob);

    expect(job).toMatchObject({
      source: "remotar",
      externalId: "123",
      title: "Desenvolvedor Front-end React TypeScript Júnior",
      company: "Acme",
      description: "Crie interfaces em React. TypeScript",
      location: "Brasil",
      workMode: "remote",
      seniority: "junior",
      url: "https://example.com/apply",
      stack: ["frontend", "react", "typescript"]
    });
    expect(job.publishedAt?.toISOString()).toBe("2026-04-27T13:00:00.000Z");
    expect(job.scrapedAt).toBeInstanceOf(Date);
    expect(job).not.toHaveProperty("raw");
    expect(job).not.toHaveProperty("salary");
    expect(job).not.toHaveProperty("tags");
  });

  it("does not classify words like internally as internship seniority", () => {
    const job = normalizeRemotarJob({
      ...baseJob,
      title: "Senior Project Manager",
      description: "Communicate internally with engineering and QA teams.",
      jobTags: [{ tag: { name: "🧓🏽 Sênior" } }]
    });

    expect(job.seniority).toBe("senior");
  });

  it("uses Remotar seniority tags to classify mid level jobs", () => {
    const job = normalizeRemotarJob({
      ...baseJob,
      title: "Analista de QA",
      jobTags: [{ tag: { name: "😎 Pleno" } }]
    });

    expect(job.seniority).toBe("mid");
  });
});
