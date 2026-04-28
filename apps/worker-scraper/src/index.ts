import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { dedupeJobs } from "../../../packages/core/dedupe.js";
import { fetchGupyJobs, isTechGupyJob, normalizeGupyJob } from "../../../packages/sources/gupy/index.js";
import { fetchRemotarJobs, isTechRemotarJob, normalizeRemotarJob } from "../../../packages/sources/remotar/index.js";

const main = async (): Promise<void> => {
  const sources = ["remotar", "gupy"];
  const maxPages = 1;
  const search = "";
  const categoryIds: number[] | undefined = undefined;
  const tagIds: number[] | undefined = undefined;
  const gupyMaxPages = 1;
  const gupyKeywords = [
    "qa", "testes", "desenvolvedor", "desenvolvedora", "developer", "frontend", "backend", "fullstack", 
    "mobile", "android", "ios", "devops", "sre", "dados", "data", "analytics", "cientista de dados", 
    "engenheiro de dados", "product owner", "product manager", "scrum master", "agile", "ux", "ui", 
    "designer ux", "cyber", "cloud", "software", "java", "python", "javascript", "typescript", ".net", 
    "node", "react"
  ];
  const gupyWorkplaceTypes: string[] | undefined = undefined;
  const outputFile = resolve("output/scraper/jobs.json");

  let since: Date | undefined;
  let existingJobs: any[] = [];
  try {
    const existingContent = await readFile(outputFile, "utf8");
    const existingData = JSON.parse(existingContent);
    if (existingData.generatedAt) {
      since = new Date(existingData.generatedAt);
      since.setHours(since.getHours() - 1);
    }
    if (Array.isArray(existingData.jobs)) {
      existingJobs = existingData.jobs;
    }
  } catch {}

  const remotarSourceJobs = sources.includes("remotar")
    ? await fetchRemotarJobs({
        maxPages: Number.isFinite(maxPages) ? maxPages : 5,
        active: true,
        search,
        categoryIds,
        tagIds,
        since,
      })
    : [];

  const gupySourceJobs = sources.includes("gupy")
    ? await fetchGupyJobs({
        keywords: gupyKeywords,
        maxPagesPerKeyword: Number.isFinite(gupyMaxPages) ? gupyMaxPages : 5,
        workplaceTypes: gupyWorkplaceTypes,
        since,
      })
    : [];

  const remotarJobs = remotarSourceJobs
    .map((sourceJob) => sourceJob.raw)
    .filter(isTechRemotarJob)
    .map(normalizeRemotarJob);

  const gupyJobs = gupySourceJobs
    .map((sourceJob) => sourceJob.raw)
    .filter(isTechGupyJob)
    .map(normalizeGupyJob);

  const normalizedJobs = dedupeJobs([...existingJobs, ...remotarJobs, ...gupyJobs]);
  const output = {
    generatedAt: new Date().toISOString(),
    sources,
    fetched: {
      remotar: remotarSourceJobs.length,
      gupy: gupySourceJobs.length,
    },
    matched: normalizedJobs.length,
    jobs: normalizedJobs,
  };

  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify({
      outputFile,
      sources,
      fetched: output.fetched,
      matched: output.matched,
    }),
  );
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
