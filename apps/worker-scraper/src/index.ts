import "dotenv/config";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { dedupeJobs } from "../../../packages/core/dedupe.js";
import { createJobCreatedEvent } from "../../../packages/core/job-event.js";
import type { JobDTO } from "../../../packages/core/types.js";
import { fetchGupyJobs, isTechGupyJob, normalizeGupyJob } from "../../../packages/sources/gupy/index.js";
import { fetchMeuPadrinhoJobs, normalizeMeuPadrinhoJob } from "../../../packages/sources/meupadrinho/index.js";
import { fetchRemotarJobs, isTechRemotarJob, normalizeRemotarJob } from "../../../packages/sources/remotar/index.js";
import { isWithinNotificationWindow, readNotificationWindowConfig, readWorkerSources, selectSourceForCycle } from "./schedule.js";
import { connectDatabase } from "#root/services/database.js";
import VagaModel from "#root/models/vaga.js";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const normalizedUrlKey = (value: string): string => {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return value;
  }
};

const jobKeys = (job: Pick<JobDTO, "source" | "externalId" | "url">): string[] => {
  const keys = [normalizedUrlKey(job.url)];
  if (job.externalId) {
    keys.push(`${job.source}:${job.externalId}`);
  }
  return keys;
};

const hasAnyJobKey = (seen: Set<string>, job: Pick<JobDTO, "source" | "externalId" | "url">): boolean =>
  jobKeys(job).some((key) => seen.has(key));

const addJobKeys = (seen: Set<string>, job: Pick<JobDTO, "source" | "externalId" | "url">): void => {
  for (const key of jobKeys(job)) {
    seen.add(key);
  }
};

type FetchLike = typeof fetch;

type SendJobCreatedWebhookOptions = {
  fetchImpl?: FetchLike;
  webhookUrl?: string;
  webhookSecret?: string;
  port?: string;
  retries?: number;
  retryDelayMs?: number;
};

const readNonNegativeInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
};

const readBoolFlag = (
  env: Record<string, string | undefined>,
  name: string,
  fallback: boolean,
): boolean => {
  const value = env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const readCsv = (value: string | undefined, fallback: string[]): string[] =>
  (value || fallback.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const defaultMeuPadrinhoCargoFilters = [
  "QA",
  "BACKEND",
  "FRONTEND",
  "FULLSTACK",
  "MOBILE",
  "DEVOPS",
  "DADOS",
  "CX",
  "SECURITY",
  "IA",
  "PRODUTO",
];

type StoredJobDeliveryState = {
  sent_discord?: boolean;
  sent_whatsapp?: boolean;
};

export const shouldRetryStoredJobDelivery = (
  job: StoredJobDeliveryState,
  env: Record<string, string | undefined> = process.env,
): boolean => {
  const discordEnabled = readBoolFlag(env, "DISCORD_ENABLED", true);
  const whatsappEnabled = readBoolFlag(env, "WHATSAPP_ENABLED", false);

  return (discordEnabled && job.sent_discord === false) ||
    (whatsappEnabled && job.sent_whatsapp === false);
};

const storedJobToDTO = (doc: Record<string, any>): JobDTO | null => {
  if (!doc.title || !doc.company || !doc.url || !doc.source) return null;

  return {
    source: doc.source,
    externalId: doc.externalId,
    title: doc.title,
    company: doc.company,
    location: doc.location,
    workMode: doc.workMode || "unknown",
    seniority: doc.seniority || "unknown",
    url: doc.url,
    summary: doc.summary,
    description: doc.description,
    stack: Array.isArray(doc.stack) ? doc.stack : [],
    salaryText: doc.salaryText,
    salaryMin: doc.salaryMin,
    salaryMax: doc.salaryMax,
    language: doc.language,
    country: doc.country,
    isInternational: doc.isInternational,
    publishedAt: doc.publishedAt,
    scrapedAt: doc.scrapedAt || doc.createdAt || new Date(),
  };
};

const resolveLocalWebhookUrl = (webhookUrl: string, port: string | undefined): string => {
  if (!webhookUrl.includes("localhost:") && !webhookUrl.includes("127.0.0.1:")) {
    return webhookUrl;
  }

  return webhookUrl.replace(/:\d+/, `:${port || 3000}`);
};

const sleepRetry = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const shouldAbortWebhookRetry = (status: number): boolean =>
  (status >= 200 && status < 300) ||
  status >= 400 && status < 500 && status !== 408 && status !== 429;

export const sendJobCreatedWebhook = async (
  job: JobDTO,
  options: SendJobCreatedWebhookOptions = {},
): Promise<boolean> => {
  let webhookUrl = options.webhookUrl ?? process.env.WEBHOOK_URL;
  if (!webhookUrl) return false;

  webhookUrl = resolveLocalWebhookUrl(webhookUrl, options.port ?? process.env.PORT);

  const headers: Record<string, string> = {
    "content-type": "application/json"
  };

  const webhookSecret = options.webhookSecret ?? process.env.WEBHOOK_SECRET;
  if (webhookSecret) {
    headers["x-webhook-secret"] = webhookSecret;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const retries = options.retries ?? readNonNegativeInt(process.env.WEBHOOK_RETRIES, 6);
  const retryDelayMs = options.retryDelayMs ?? readNonNegativeInt(process.env.WEBHOOK_RETRY_DELAY_MS, 1000);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(createJobCreatedEvent(job))
      });

      if (response.status === 200) {
        return true;
      }

      const body = await response.text().catch(() => "");
      lastError = new Error(`webhook failed (${response.status}): ${body}`);

      if (shouldAbortWebhookRetry(response.status)) throw lastError;
    } catch (error) {
      lastError = error;
      if (error instanceof Error && /^webhook failed \((2|4)/.test(error.message)) {
        throw error;
      }
    }

    if (attempt < retries && retryDelayMs > 0) {
      await sleepRetry(retryDelayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

let pendingWebhookJobs: JobDTO[] = [];

export const runCycle = async (): Promise<void> => {
  const workerIntervalMs = Number(process.env.WORKER_INTERVAL_MS) || 10 * 60 * 1000;
  const allSources = readWorkerSources();
  const sources = [selectSourceForCycle(allSources, new Date(), workerIntervalMs)];
  console.log(`🎯 Fonte do ciclo: ${sources[0]} (${allSources.join(" -> ")})`);
  
  const maxPages = Number(process.env.REMOTAR_MAX_PAGES || 3);
  const search = "";
  const categoryIds: number[] | undefined = undefined;
  const tagIds: number[] | undefined = undefined;
  const gupyMaxPages = Number(process.env.GUPY_MAX_PAGES_PER_KEYWORD || 1);
  const meuPadrinhoMaxPages = Number(process.env.MEUPADRINHO_MAX_PAGES || 10);
  const meuPadrinhoCargoFilters = readCsv(
    process.env.MEUPADRINHO_CARGO_FILTERS,
    defaultMeuPadrinhoCargoFilters,
  );
  const gupyKeywords = [
    "qa", "testes", "desenvolvedor", "desenvolvedora", "developer", "frontend", "backend", "fullstack", 
    "mobile", "android", "ios", "devops", "sre", "dados", "data", "analytics", "cientista de dados", 
    "engenheiro de dados", "product owner", "product manager", "scrum master", "agile", "ux", "ui", 
    "designer ux", "cyber", "cloud", "software", "java", "python", "javascript", "typescript", ".net", 
    "node", "react"
  ];
  const gupyWorkplaceTypes: string[] | undefined = undefined;
  const webhookLimit = Number(process.env.WEBHOOK_MAX_JOBS_PER_RUN || 50);
  const webhookDelayMs = Number(process.env.WEBHOOK_DELAY_MS || 1000);
  const notificationWindow = readNotificationWindowConfig();
  const canSendWebhooksNow = isWithinNotificationWindow(new Date(), notificationWindow);

  let since: Date | undefined;
  
  // Conecta ao MongoDB para obter vagas existentes
  await connectDatabase();
  const existingDbJobs = await VagaModel.find({}, {
    url: 1,
    externalId: 1,
    source: 1,
    title: 1,
    company: 1,
    summary: 1,
    description: 1,
    location: 1,
    workMode: 1,
    seniority: 1,
    stack: 1,
    salaryText: 1,
    salaryMin: 1,
    salaryMax: 1,
    language: 1,
    country: 1,
    isInternational: 1,
    publishedAt: 1,
    scrapedAt: 1,
    createdAt: 1,
    sent_discord: 1,
    sent_whatsapp: 1,
  }).lean();
  
  // Otimiza o since baseado na vaga mais recente no banco
  if (existingDbJobs.length > 0) {
    const mostRecent = existingDbJobs.reduce((latest, current) => {
      if (!latest.createdAt) return current;
      if (!current.createdAt) return latest;
      return latest.createdAt > current.createdAt ? latest : current;
    }, existingDbJobs[0]);
    if (mostRecent.createdAt) {
      since = new Date(mostRecent.createdAt);
      since.setHours(since.getHours() - 2); // margem de segurança
    }
  }

  const existingKeys = new Set<string>();
  for (const doc of existingDbJobs) {
    if (doc.url) {
      addJobKeys(existingKeys, { url: doc.url as string, externalId: doc.externalId as string, source: doc.source as any });
    }
  }

  const retryExistingJobs = existingDbJobs
    .filter((job) => shouldRetryStoredJobDelivery(job))
    .map((job) => storedJobToDTO(job))
    .filter((job): job is JobDTO => Boolean(job));

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
        maxPages: Number.isFinite(meuPadrinhoMaxPages) ? meuPadrinhoMaxPages : 10,
        cargoFilters: meuPadrinhoCargoFilters,
        // não passar since para o meupadrinho por causa de fuso horário da API, o dedupe do worker lida com isso.
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
  
  for (const job of pendingWebhookJobs) {
    addJobKeys(existingKeys, job);
  }
  
  const newJobs = fetchedJobs.filter((job) => !hasAnyJobKey(existingKeys, job));
  const queuedJobs = dedupeJobs([...pendingWebhookJobs, ...retryExistingJobs, ...newJobs]);

  let webhookSent = 0;
  let webhookFailed = 0;
  let webhookHeld = 0;
  const acceptedNewJobKeys = new Set<string>();
  const jobsToNotify = process.env.WEBHOOK_URL
    ? canSendWebhooksNow
      ? queuedJobs.slice(0, Number.isFinite(webhookLimit) ? webhookLimit : 50)
      : []
    : [];

  if (!process.env.WEBHOOK_URL) {
    for (const job of newJobs) {
      addJobKeys(acceptedNewJobKeys, job);
    }
  }

  if (process.env.WEBHOOK_URL && !canSendWebhooksNow) {
    webhookHeld = queuedJobs.length;
  }

  for (const job of jobsToNotify) {
    try {
      const sent = await sendJobCreatedWebhook(job);
      if (sent) {
        webhookSent += 1;
        addJobKeys(acceptedNewJobKeys, job);
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

  const pendingAfterRun = process.env.WEBHOOK_URL
    ? queuedJobs.filter((job) => !hasAnyJobKey(acceptedNewJobKeys, job))
    : [];
    
  pendingWebhookJobs = pendingAfterRun;

  const fetchedTotal = remotarSourceJobs.length + meuPadrinhoSourceJobs.length + gupySourceJobs.length;

  console.log(`\n📊 === Resultado do Ciclo ===`);
  console.log(`   📥 Capturados: ${fetchedTotal} vagas (meupadrinho: ${meuPadrinhoSourceJobs.length}, remotar: ${remotarSourceJobs.length}, gupy: ${gupySourceJobs.length})`);
  console.log(`   🆕 Novas: ${newJobs.length}`);
  if (process.env.WEBHOOK_URL) {
    console.log(`   📡 Webhook: ${webhookSent} enviados, ${webhookFailed} falhas, ${pendingAfterRun.length} pendentes (de ${jobsToNotify.length} tentados)`);
    if (retryExistingJobs.length > 0) {
      console.log(`   🔁 Retentativas do banco: ${retryExistingJobs.length}`);
    }
    if (!canSendWebhooksNow) {
      console.log(`   🔕 Janela silenciosa ativa: segurando ${webhookHeld} vagas para enviar depois`);
    }
  }
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

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isMain) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
