import crypto from "node:crypto";
import {
  createVagaIfNotExists,
  listVagas,
  listRecentVagas,
} from "#root/repository/vagaRepository.js";

// =========================
// Cache simples em memória
// =========================
const CACHE_TTL = 30 * 1000;
const cache = new Map();

const getCacheKey = (filters, options) =>
  JSON.stringify({ filters, options });

const getFromCache = (key) => {
  const entry = cache.get(key);

  if (!entry) return null;

  if (Date.now() > entry.expireAt) {
    cache.delete(key);
    return null;
  }

  return entry.data;
};

const setCache = (key, data) => {
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
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const generateContentHash = (job) => {
  const base = [
    normalize(job.title),
    normalize(job.company),
    normalize(job.location),
  ].join("|");

  return crypto.createHash("sha1").update(base).digest("hex");
};

// =========================
// Create vaga
// =========================
export async function createVaga(data) {
  const contentHash = generateContentHash(data);

  const result = await createVagaIfNotExists({
    ...data,
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
export async function getVagas(filters = {}, options = {}) {
  const key = getCacheKey(filters, options);

  const cached = getFromCache(key);
  if (cached) return cached;

  const result = await listVagas(filters, options);

  setCache(key, result);

  return result;
}

// =========================
// Recent vagas (com cache)
// =========================
export async function getRecentVagas(limit) {
  const key = `recent:${limit ?? "default"}`;

  const cached = getFromCache(key);
  if (cached) return cached;

  const result = await listRecentVagas(limit);

  setCache(key, result);

  return result;
}
