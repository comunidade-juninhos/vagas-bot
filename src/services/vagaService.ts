import crypto from "node:crypto";
import type { JobSource } from "../../packages/core/types.js";
import {
  createVagaIfNotExists,
  listVagas,
  listRecentVagas,
  updateVagaStatus as updateVagaRepo
} from "../repository/vagaRepository.js";

// =========================
// Cache simples em memória
// =========================
const CACHE_TTL = 30 * 1000;
const cache = new Map<string, { data: unknown; expireAt: number }>();

type QueryRecord = Record<string, any>;

const getCacheKey = (filters: QueryRecord, options: QueryRecord) =>
  JSON.stringify({ filters, options });

const getFromCache = <T>(key: string): T | null => {
  const entry = cache.get(key);

  if (!entry) return null;

  if (Date.now() > entry.expireAt) {
    cache.delete(key);
    return null;
  }

  return entry.data as T;
};

const setCache = (key: string, data: unknown) => {
  cache.set(key, {
    data,
    expireAt: Date.now() + CACHE_TTL,
  });
};

const clearCache = () => {
  cache.clear();
};

// =========================
// Hash (dedupe)
// =========================
const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const generateContentHash = (job: QueryRecord) => {
  const base = [
    normalize(job.title),
    normalize(job.company),
    normalize(job.location),
  ].join("|");

  return crypto.createHash("sha1").update(base).digest("hex");
};

const detectApplySourceFromUrl = (url: unknown): JobSource => {
  const normalized = String(url ?? "").toLowerCase();
  if (normalized.includes("gupy.io")) return "gupy";
  if (normalized.includes("linkedin.com")) return "linkedin";
  if (normalized.includes("indeed.com") || normalized.includes("indeed.com.br")) return "indeed";
  if (normalized.includes("remotar.com.br")) return "remotar";
  if (normalized.includes("meupadrinho.com.br")) return "meupadrinho";
  if (normalized.includes("greenhouse.io")) return "greenhouse";
  if (normalized.includes("lever.co")) return "lever";
  return "company-site";
};

// =========================
// Create vaga
// =========================
export async function createVaga(data: QueryRecord) {
  const contentHash = generateContentHash(data);
  const source = detectApplySourceFromUrl(data.url);

  const result = await createVagaIfNotExists({
    ...data,
    source,
    contentHash,
  });

  if (result.created) {
    clearCache();
  }

  return result;
}

// =========================
// List vagas (com cache)
// =========================
export async function getVagas(filters: QueryRecord = {}, options: QueryRecord = {}) {
  const key = getCacheKey(filters, options);

  const cached = getFromCache<Awaited<ReturnType<typeof listVagas>>>(key);
  if (cached) return cached;

  const result = await listVagas(filters, options);

  setCache(key, result);

  return result;
}

// =========================
// Recent vagas (com cache)
// =========================
export async function getRecentVagas(limit?: unknown) {
  const key = `recent:${limit ?? "default"}`;

  const cached = getFromCache<Awaited<ReturnType<typeof listRecentVagas>>>(key);
  if (cached) return cached;

  const result = await listRecentVagas(limit);

  setCache(key, result);

  return result;
}

export async function updateVagaStatus(id: unknown, data: QueryRecord) {
  return updateVagaRepo(id, data);
}
