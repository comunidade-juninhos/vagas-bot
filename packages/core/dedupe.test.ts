import { describe, expect, it } from "vitest";
import { dedupeJobs } from "./dedupe.js";
import type { JobDTO } from "./types.js";

const job = (overrides: Partial<JobDTO>): JobDTO => ({
  source: "remotar",
  externalId: "1",
  title: "QA Engineer",
  company: "Acme",
  description: "",
  url: "https://remotar.com.br/jobs/1",
  seniority: "unknown",
  workMode: "remote",
  location: "Brasil",
  stack: ["qa"],
  publishedAt: undefined,
  scrapedAt: new Date("2026-04-28T12:00:00.000Z"),
  ...overrides
});

describe("dedupeJobs", () => {
  it("deduplicates by source and source id first", () => {
    const jobs = dedupeJobs([
      job({ externalId: "42", title: "QA Engineer" }),
      job({ externalId: "42", title: "QA Engineer Updated" })
    ]);

    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("QA Engineer");
  });

  it("deduplicates cross-source jobs by title, company, and location", () => {
    const jobs = dedupeJobs([
      job({ source: "remotar", externalId: "1", title: "Dev Backend", company: "Acme" }),
      job({ source: "indeed", externalId: "99", title: "dev backend", company: "ACME" })
    ]);

    expect(jobs).toHaveLength(1);
  });

  it("deduplicates Remotar and Gupy jobs that point to the same Gupy job id", () => {
    const remotarUrl = "https://gaudium.gupy.io/job/eyJqb2JJZCI6MTEwNzcwODEsInNvdXJjZSI6InJlbW90YXIifQ==?jobBoardSource=remotar";
    const gupyUrl = "https://gaudium.gupy.io/job/eyJqb2JJZCI6MTEwNzcwODEsInNvdXJjZSI6Imd1cHlfcG9ydGFsIn0=?jobBoardSource=gupy_portal";

    const jobs = dedupeJobs([
      job({ source: "remotar", externalId: "135670", title: "Desenvolvedor Frontend", company: "Gaudium", url: remotarUrl }),
      job({ source: "gupy", externalId: "11077081", title: "Pessoa Desenvolvedora Frontend", company: "Gaudium", url: gupyUrl })
    ]);

    expect(jobs).toHaveLength(1);
    expect(jobs[0].source).toBe("remotar");
  });

  it("deduplicates repeated external links from the same source even when source ids differ", () => {
    const url = "https://scopicsoftware.zohorecruit.com/jobs/Careers/741923000039370288/Remote-Web-Engineering-Internship-Program";

    const jobs = dedupeJobs([
      job({ externalId: "135711", title: "Remote Web Engineering Intern", company: "Scopic Software", url }),
      job({ externalId: "135654", title: "Remote Web Engineering Intern", company: "Scopic Software", url })
    ]);

    expect(jobs).toHaveLength(1);
  });
});
