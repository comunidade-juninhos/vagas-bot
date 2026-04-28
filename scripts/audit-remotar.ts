import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { dedupeJobs } from "../packages/core/dedupe.js";
import { fetchRemotarJobs } from "../packages/sources/remotar/remotar.scraper.js";
import { isTechRemotarJob, normalizeRemotarJob, type RemotarJob } from "../packages/sources/remotar/remotar.parser.js";

type AuditJob = {
  id: string;
  title: string;
  company: string;
  categories: string[];
  tags: string[];
  url: string | null;
  kept: boolean;
  possibleTechSignal: string[];
};

const outputDir = resolve("output/scraper/audit-remotar");

const cleanLabel = (value: string): string =>
  value
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/\s+/g, " ")
    .trim();

const categoriesOf = (job: RemotarJob): string[] =>
  (job.jobCategories ?? [])
    .map((item) => item.category?.name)
    .filter((name): name is string => Boolean(name))
    .map(cleanLabel);

const tagsOf = (job: RemotarJob): string[] =>
  (job.jobTags ?? [])
    .map((item) => item.tag?.name)
    .filter((name): name is string => Boolean(name))
    .map(cleanLabel);

const possibleTechSignals = (job: RemotarJob): string[] => {
  const title = job.title ?? "";
  const categories = categoriesOf(job);
  const signals: string[] = [];

  if (
    /(dev|desenvolvedor|desenvolvedora|developer|engineer|engenheir|qa|test|frontend|backend|fullstack|mobile|sre|devops|dados|data|seguran[cç]a|cyber|cloud|bi)/i.test(
      title,
    )
  ) {
    signals.push("title");
  }

  if (categories.some((category) => /(programa|qa|devops|sysadmin|data science|analytics|ux|ui)/i.test(category))) {
    signals.push("category");
  }

  return signals;
};

const toAuditJob = (job: RemotarJob, keptIds: Set<string>): AuditJob => ({
  id: String(job.id),
  title: (job.title ?? "").trim(),
  company: (job.companyDisplayName ?? job.company?.name ?? "Empresa não informada").trim(),
  categories: categoriesOf(job),
  tags: tagsOf(job),
  url: job.externalLink ?? `https://remotar.com.br/jobs/${job.id}`,
  kept: keptIds.has(String(job.id)),
  possibleTechSignal: possibleTechSignals(job),
});

const main = async (): Promise<void> => {
  const allSourceJobs = await fetchRemotarJobs({
    maxPages: 3,
    active: true,
    categoryIds: null,
  });

  const rawJobs = allSourceJobs.map((job) => job.raw);
  const filteredJobs = rawJobs.filter(isTechRemotarJob).map(normalizeRemotarJob);
  const keptJobs = dedupeJobs(filteredJobs);
  const keptIds: Set<string> = new Set(keptJobs.map((job) => String(job.externalId)));
  const auditJobs = rawJobs.map((job) => toAuditJob(job, keptIds));
  const removed = auditJobs.filter((job) => !job.kept);
  const removedWithSignals = removed.filter((job) => job.possibleTechSignal.length > 0);
  const kept = auditJobs.filter((job) => job.kept);

  await mkdir(outputDir, { recursive: true });
  await writeFile(`${outputDir}/all-raw.json`, `${JSON.stringify(rawJobs, null, 2)}\n`, "utf8");
  await writeFile(`${outputDir}/kept-normalized.json`, `${JSON.stringify(keptJobs, null, 2)}\n`, "utf8");
  await writeFile(`${outputDir}/filtered-before-dedupe.json`, `${JSON.stringify(filteredJobs, null, 2)}\n`, "utf8");
  await writeFile(
    `${outputDir}/audit.json`,
    `${JSON.stringify({ total: auditJobs.length, keptByFilter: kept.length, keptAfterDedupe: keptJobs.length, removed: removed.length, removedWithSignals, jobs: auditJobs }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(`${outputDir}/removed-with-signals.json`, `${JSON.stringify(removedWithSignals, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify({
      outputDir,
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
