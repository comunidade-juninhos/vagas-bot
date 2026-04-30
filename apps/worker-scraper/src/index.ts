import "dotenv/config";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { dedupeJobs } from "../../../packages/core/dedupe.js";
import { createJobCreatedEvent } from "../../../packages/core/job-event.js";
import type { JobDTO } from "../../../packages/core/types.js";
import { fetchGupyJobs, isTechGupyJob, normalizeGupyJob } from "../../../packages/sources/gupy/index.js";
import { fetchMeuPadrinhoJobs, normalizeMeuPadrinhoJob } from "../../../packages/sources/meupadrinho/index.js";
import { fetchRemotarJobs, isTechRemotarJob, normalizeRemotarJob } from "../../../packages/sources/remotar/index.js";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const jobKey = (job: Pick<JobDTO, "source" | "externalId" | "url">): string =>
  job.externalId ? `${job.source}:${job.externalId}` : job.url;

const parseSources = (): string[] =>
  (process.env.JOB_SOURCES || "meupadrinho")
    .split(",")
    .map((source) => source.trim().toLowerCase())
    .filter(Boolean);

const sendJobCreatedWebhook = async (job: JobDTO): Promise<boolean> => {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) return false;

  const headers: Record<string, string> = {
    "content-type": "application/json"
  };

  if (process.env.WEBHOOK_SECRET) {
    headers["x-webhook-secret"] = process.env.WEBHOOK_SECRET;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(createJobCreatedEvent(job))
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`webhook failed (${response.status}): ${body}`);
  }

  return true;
};

const runCycle = async (): Promise<void> => {
  const sources = parseSources();
  const maxPages = 1;
  const search = "";
  const categoryIds: number[] | undefined = undefined;
  const tagIds: number[] | undefined = undefined;
  const gupyMaxPages = 1;
  const meuPadrinhoMaxPages = Number(process.env.MEUPADRINHO_MAX_PAGES || 3);
  const gupyKeywords = [
    "qa", "testes", "desenvolvedor", "desenvolvedora", "developer", "frontend", "backend", "fullstack", 
    "mobile", "android", "ios", "devops", "sre", "dados", "data", "analytics", "cientista de dados", 
    "engenheiro de dados", "product owner", "product manager", "scrum master", "agile", "ux", "ui", 
    "designer ux", "cyber", "cloud", "software", "java", "python", "javascript", "typescript", ".net", 
    "node", "react"
  ];
  const gupyWorkplaceTypes: string[] | undefined = undefined;
  const outputFile = resolve("output/scraper/jobs.json");
  const webhookLimit = Number(process.env.WEBHOOK_MAX_JOBS_PER_RUN || 10);
  const webhookDelayMs = Number(process.env.WEBHOOK_DELAY_MS || 1000);

  let since: Date | undefined;
  let existingJobs: JobDTO[] = [];
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

  const meuPadrinhoSourceJobs = sources.includes("meupadrinho")
    ? await fetchMeuPadrinhoJobs({
        maxPages: Number.isFinite(meuPadrinhoMaxPages) ? meuPadrinhoMaxPages : 3,
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

  const meuPadrinhoJobs = meuPadrinhoSourceJobs.map((sourceJob) => normalizeMeuPadrinhoJob(sourceJob.raw));

  const fetchedJobs = dedupeJobs([...meuPadrinhoJobs, ...remotarJobs, ...gupyJobs]);
  const existingKeys = new Set(existingJobs.map(jobKey));
  const newJobs = fetchedJobs.filter((job) => !existingKeys.has(jobKey(job)));

  let webhookSent = 0;
  let webhookFailed = 0;
  const acceptedNewJobKeys = new Set<string>();
  const jobsToNotify = process.env.WEBHOOK_URL
    ? newJobs.slice(0, Number.isFinite(webhookLimit) ? webhookLimit : 10)
    : [];

  if (!process.env.WEBHOOK_URL) {
    for (const job of newJobs) {
      acceptedNewJobKeys.add(jobKey(job));
    }
  }

  for (const job of jobsToNotify) {
    try {
      const sent = await sendJobCreatedWebhook(job);
      if (sent) {
        webhookSent += 1;
        acceptedNewJobKeys.add(jobKey(job));
      }
    } catch (error) {
      webhookFailed += 1;
      console.error(
        JSON.stringify({
          level: "error",
          msg: "jobs.created webhook failed",
          title: job.title,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    }

    if (webhookDelayMs > 0) {
      await sleep(webhookDelayMs);
    }
  }

  const acceptedNewJobs = newJobs.filter((job) => acceptedNewJobKeys.has(jobKey(job)));
  const normalizedJobs = dedupeJobs([...existingJobs, ...acceptedNewJobs]);

  const output = {
    generatedAt: new Date().toISOString(),
    sources,
    fetched: {
      remotar: remotarSourceJobs.length,
      meupadrinho: meuPadrinhoSourceJobs.length,
      gupy: gupySourceJobs.length,
    },
    newJobs: newJobs.length,
    webhook: {
      configured: Boolean(process.env.WEBHOOK_URL),
      attempted: jobsToNotify.length,
      sent: webhookSent,
      failed: webhookFailed,
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
      newJobs: output.newJobs,
      webhook: output.webhook,
      matched: output.matched,
    }),
  );
};

const main = async (): Promise<void> => {
  const RUN_INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS) || 10 * 60 * 1000;
  
  console.log(`🚀 Iniciando Worker Scraper (loop a cada ${RUN_INTERVAL_MS / 1000 / 60} minutos)...`);
  
  while (true) {
    try {
      console.log(`\n⏳ [${new Date().toISOString()}] Iniciando ciclo de busca...`);
      await runCycle();
    } catch (error) {
      console.error(`❌ [${new Date().toISOString()}] Erro durante o ciclo de busca:`);
      console.error(error instanceof Error ? error.message : error);
    }
    
    console.log(`💤 [${new Date().toISOString()}] Ciclo finalizado. Aguardando próximo ciclo...`);
    await sleep(RUN_INTERVAL_MS);
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
