import crypto from "node:crypto";
import type { JobSource } from "../../packages/core/types.js";
import {
  createVagaIfNotExists,
  listVagas,
  listRecentVagas,
  listVagasForDigest,
  listPendingDiscordVagas,
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

// =========================
// Sniper Filter: Junior & Estágio
// =========================
export function filterJuniorAndIntern(job: any): boolean {
  // 0. VALIDAÇÃO DE SENIORIDADE CONFIGURADA (Filtro Estrito)
  if (job.seniority) {
    const allowed = (process.env.ALLOWED_SENIORITIES || "intern,junior")
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    if (!allowed.includes(job.seniority.toLowerCase())) {
      return false;
    }
  }

  const title = String(job.title || "").toLowerCase();
  
  // 1. BLACKLIST AGRESSIVA: Se tiver qualquer termo de senioridade alta ou liderança, descarta.
  const blacklist = [
    'senior', 'sênior', 'sr', 'sr.', 'pleno', 'pl', 'specialist', 'especialista', 
    'lead', 'lider', 'líder', 'manager', 'gerente', 'coordenador', 'coordinator',
    'tech lead', 'principal', 'staff', 'expert', 'iii', 'iv', 'v', 'n3', 'n4',
    'specialist', 'arquitetura', 'architecture', 'architect', 'arquiteto',
    'consultant', 'consultor', 'head', 'diretor', 'director', 'vp', 'cto'
  ];
  
  const hasBlacklist = blacklist.some(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    return regex.test(title);
  });

  if (hasBlacklist) return false;

  // 2. WHITELIST: Se tiver termos explícitos de junior/estágio/trainee, aceita NA HORA.
  const whitelist = [
    'junior', 'júnior', 'jr', 'jr.', 'estagio', 'estágio', 'estagiario', 'estagiário', 
    'estagiaria', 'estagiária', 'intern', 'internship', 'trainee', 'aprendiz', 
    'beginner', 'iniciante', 'entry', 'i', 'n1', 'lvl 1', 'level 1', 'nível 1', 'nível i'
  ];

  const hasWhitelist = whitelist.some(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    return regex.test(title);
  });

  if (hasWhitelist) return true;

  // 3. FILTRO DE NEUTRALIDADE (Onde mora o perigo)
  // Se não tem nível definido (ex: "Dev Java"), olhamos se o título não parece "avançado" demais.
  const suspectTerms = ['especialista', 'expert', 'cloud', 'architecture', 'patterns', 'advanced'];
  const isSuspect = suspectTerms.some(term => title.includes(term));

  if (isSuspect) return false;

  // Se passou pela blacklist e não é suspeito (vaga "neutra"), deixamos passar.
  return true; 
}

export async function getVagasForDigest(since: Date) {
  return listVagasForDigest(since);
}

/**
 * Busca apenas vagas que passam no filtro Sniper e respeita o limite (ex: 5)
 */
export async function getPendingDiscordVagas(limit: number = 5) {
  // Buscamos um lote maior (ex: 50) para garantir que após o filtro tenhamos o suficiente
  const rawJobs = await listPendingDiscordVagas(50);
  
  // Aplica o filtro Sniper
  const filtered = rawJobs.filter(filterJuniorAndIntern);
  
  // Retorna apenas as primeiras X vagas do filtro
  return filtered.slice(0, limit);
}

export async function updateVagaStatus(id: unknown, data: QueryRecord) {
  return updateVagaRepo(id, data);
}
