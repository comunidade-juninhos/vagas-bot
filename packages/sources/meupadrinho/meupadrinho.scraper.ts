import pLimit from "p-limit";
import { browserHeaders } from "../http.js";
import type { SourceJob } from "../types.js";
import type { MeuPadrinhoJob } from "./meupadrinho.parser.js";

const BASE_URL = "https://meupadrinho.com.br/api";

export type MeuPadrinhoScraperOptions = {
  maxPages?: number;
  since?: Date;
  cargoFilters?: string[];
  listRetries?: number;
  listRetryDelayMs?: number;
  listDelayMs?: number;
  detailConcurrency?: number;
  detailRetries?: number;
  detailRetryDelayMs?: number;
  detailDelayMs?: number;
};

type MeuPadrinhoListResponse = {
  vagas?: Array<Pick<MeuPadrinhoJob, "nano_id" | "horario_registro" | "vaga_encerrada">>;
  tem_proxima_pagina?: boolean;
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: browserHeaders({
      accept: "application/json, text/plain, */*",
      referer: "https://meupadrinho.com.br/vagas",
    }),
  });

  if (!response.ok) {
    throw new Error(`Meu Padrinho request failed (${response.status}) ${url}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch (error) {
    console.error(`Failed to parse JSON for url ${url}: ${text.slice(0, 100)}`);
    throw error;
  }
};

const isAfterSince = (value: string | null | undefined, since?: Date): boolean => {
  if (!since || !value) return true;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date >= since;
};

const buildListUrl = (page: number, cargoFilter?: string): string => {
  const url = new URL(`${BASE_URL}/vagas`);
  url.searchParams.set("page", String(page));

  if (cargoFilter) {
    url.searchParams.append("cargos", cargoFilter);
  }

  return url.toString();
};

const uniqueCargoFilters = (values: string[] | undefined): string[] => [
  ...new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const readPositiveInt = (value: number | undefined, fallback: number): number => {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.trunc(value));
};

const fetchDetailWithRetry = async (
  nanoId: string,
  retries: number,
  retryDelayMs: number,
): Promise<MeuPadrinhoJob | null> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchJson<MeuPadrinhoJob>(`${BASE_URL}/vagas/${nanoId}`);
    } catch (error) {
      lastError = error;
      if (attempt < retries && retryDelayMs > 0) {
        await sleep(retryDelayMs);
      }
    }
  }

  console.warn(
    `[MeuPadrinho] Skipping detail ${nanoId}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
  return null;
};

const fetchListWithRetry = async (
  url: string,
  page: number,
  cargoFilter: string | undefined,
  retries: number,
  retryDelayMs: number,
): Promise<MeuPadrinhoListResponse | null> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchJson<MeuPadrinhoListResponse>(url);
    } catch (error) {
      lastError = error;
      if (attempt < retries && retryDelayMs > 0) {
        await sleep(retryDelayMs);
      }
    }
  }

  const filterLabel = cargoFilter ? ` (${cargoFilter})` : "";
  console.warn(
    `[MeuPadrinho] Skipping list page ${page}${filterLabel}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
  return null;
};

export async function fetchMeuPadrinhoJobs(
  options: MeuPadrinhoScraperOptions = {}
): Promise<Array<SourceJob<MeuPadrinhoJob>>> {
  const maxPages = Math.max(1, options.maxPages ?? 3);
  const listRetries = Math.max(0, Math.trunc(options.listRetries ?? 2));
  const listRetryDelayMs = Math.max(0, Math.trunc(options.listRetryDelayMs ?? 1500));
  const listDelayMs = Math.max(0, Math.trunc(options.listDelayMs ?? 0));
  const detailConcurrency = readPositiveInt(options.detailConcurrency, 2);
  const detailRetries = Math.max(0, Math.trunc(options.detailRetries ?? 2));
  const detailRetryDelayMs = Math.max(0, Math.trunc(options.detailRetryDelayMs ?? 1500));
  const detailDelayMs = Math.max(0, Math.trunc(options.detailDelayMs ?? 0));
  const cargoFilters = uniqueCargoFilters(options.cargoFilters);
  const listQueries = [undefined, ...cargoFilters];
  const listItems: Array<Pick<MeuPadrinhoJob, "nano_id" | "horario_registro" | "vaga_encerrada">> = [];
  const seenListIds = new Set<string>();

  for (const cargoFilter of listQueries) {
    for (let page = 0; page < maxPages; page += 1) {
      if (listDelayMs > 0 && (cargoFilter !== listQueries[0] || page > 0)) {
        await sleep(listDelayMs);
      }
      
      const data = await fetchListWithRetry(
        buildListUrl(page, cargoFilter),
        page,
        cargoFilter,
        listRetries,
        listRetryDelayMs,
      );
      if (!data) break;

      const vagas = data.vagas ?? [];

      for (const job of vagas) {
        if (
          job.vaga_encerrada ||
          !isAfterSince(job.horario_registro, options.since) ||
          seenListIds.has(job.nano_id)
        ) {
          continue;
        }

        seenListIds.add(job.nano_id);
        listItems.push(job);
      }

      if (!data.tem_proxima_pagina || vagas.length === 0) break;
    }
  }

  const limit = pLimit(detailConcurrency);
  const details = await Promise.all(
    listItems.map((item, index) =>
      limit(async (): Promise<SourceJob<MeuPadrinhoJob> | null> => {
        if (index > 0 && detailDelayMs > 0) {
          await sleep(detailDelayMs);
        }
        const detail = await fetchDetailWithRetry(item.nano_id, detailRetries, detailRetryDelayMs);
        if (!detail) return null;

        return {
          source: "meupadrinho",
          externalId: detail.nano_id,
          raw: detail
        };
      })
    )
  );

  return details.filter((detail): detail is SourceJob<MeuPadrinhoJob> => Boolean(detail));
}
