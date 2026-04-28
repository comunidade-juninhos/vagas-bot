import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { dedupeJobs } from "../packages/core/dedupe.js";
import { fetchGupyJobs } from "../packages/sources/gupy/gupy.scraper.js";
import { isTechGupyJob, normalizeGupyJob, type GupyJob } from "../packages/sources/gupy/gupy.parser.js";

const outputDir = resolve("output/scraper/audit-gupy");

const keywords = [
  "qa",
  "testes",
  "desenvolvedor",
  "desenvolvedora",
  "developer",
  "frontend",
  "backend",
  "fullstack",
  "mobile",
  "android",
  "ios",
  "devops",
  "sre",
  "dados",
  "data",
  "analytics",
  "cientista de dados",
  "engenheiro de dados",
  "product owner",
  "product manager",
  "scrum master",
  "agile",
  "ux",
  "ui",
  "designer ux",
  "cyber",
  "cloud",
  "software",
  "java",
  "python",
  "javascript",
  "typescript",
  ".net",
  "node",
  "react",
];

type AuditJob = {
  id: string;
  title: string;
  company: string;
  workplaceType: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  url: string | null;
  kept: boolean;
  possibleTechSignal: string[];
};

const possibleTechSignals = (job: GupyJob): string[] => {
  const title = job.name ?? "";
  const signals: string[] = [];

  if (
    /(qa|testes?|desenvolvedor|desenvolvedora|developer|engineer|engenheir|frontend|backend|fullstack|mobile|android|ios|devops|sre|dados|data|analytics|software|java|python|javascript|typescript|node|react|cloud|cyber|seguran[cç]a|product owner|product manager|scrum|agile|ux|ui)/i.test(
      title,
    )
  ) {
    signals.push("title");
  }

  if ((job.skills ?? []).length > 0) {
    signals.push("skills");
  }

  return signals;
};

const toAuditJob = (job: GupyJob, keptIds: Set<string>): AuditJob => ({
  id: String(job.id),
  title: (job.name ?? "").trim(),
  company: (job.careerPageName ?? "Empresa não informada").trim(),
  workplaceType: job.workplaceType ?? null,
  city: job.city?.trim() || null,
  state: job.state?.trim() || null,
  country: job.country?.trim() || null,
  url: job.jobUrl ?? null,
  kept: keptIds.has(String(job.id)),
  possibleTechSignal: possibleTechSignals(job),
});

const uniqueById = (jobs: GupyJob[]): GupyJob[] => {
  const seen = new Set<string>();
  const unique: GupyJob[] = [];

  for (const job of jobs) {
    const id = String(job.id);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(job);
  }

  return unique;
};

const main = async (): Promise<void> => {
  const sourceJobs = await fetchGupyJobs({
    keywords,
    maxPagesPerKeyword: 1,
    limit: 100,
  });

  const rawJobs = uniqueById(sourceJobs.map((job) => job.raw));
  const filteredJobs = rawJobs.filter(isTechGupyJob).map(normalizeGupyJob);
  const keptJobs = dedupeJobs(filteredJobs);
  const keptIds: Set<string> = new Set(keptJobs.map((job) => String(job.externalId)));
  const auditJobs = rawJobs.map((job) => toAuditJob(job, keptIds));
  const kept = auditJobs.filter((job) => job.kept);
  const removed = auditJobs.filter((job) => !job.kept);
  const removedWithSignals = removed.filter((job) => job.possibleTechSignal.length > 0);

  await mkdir(outputDir, { recursive: true });
  await writeFile(`${outputDir}/all-raw.json`, `${JSON.stringify(rawJobs, null, 2)}\n`, "utf8");
  await writeFile(`${outputDir}/filtered-before-dedupe.json`, `${JSON.stringify(filteredJobs, null, 2)}\n`, "utf8");
  await writeFile(`${outputDir}/kept-normalized.json`, `${JSON.stringify(keptJobs, null, 2)}\n`, "utf8");
  await writeFile(`${outputDir}/removed-with-signals.json`, `${JSON.stringify(removedWithSignals, null, 2)}\n`, "utf8");
  await writeFile(
    `${outputDir}/audit.json`,
    `${JSON.stringify({ keywords, total: auditJobs.length, keptByFilter: kept.length, keptAfterDedupe: keptJobs.length, removed: removed.length, removedWithSignals, jobs: auditJobs }, null, 2)}\n`,
    "utf8",
  );

  console.log(
    JSON.stringify({
      outputDir,
      keywords: keywords.length,
      total: auditJobs.length,
      keptByFilter: kept.length,
      keptAfterDedupe: keptJobs.length,
      removed: removed.length,
      removedWithSignals: removedWithSignals.length,
    }),
  );
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
