import pLimit from "p-limit";
import type { SourceJob } from "../types.js";
import type { MeuPadrinhoJob } from "./meupadrinho.parser.js";

const BASE_URL = "https://meupadrinho.com.br/api";

export type MeuPadrinhoScraperOptions = {
  maxPages?: number;
  since?: Date;
};

type MeuPadrinhoListResponse = {
  vagas?: Array<Pick<MeuPadrinhoJob, "nano_id" | "horario_registro" | "vaga_encerrada">>;
  tem_proxima_pagina?: boolean;
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "vagas-bot/0.1 (+https://github.com/)"
    }
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

export async function fetchMeuPadrinhoJobs(
  options: MeuPadrinhoScraperOptions = {}
): Promise<Array<SourceJob<MeuPadrinhoJob>>> {
  const maxPages = Math.max(1, options.maxPages ?? 3);
  const listItems: Array<Pick<MeuPadrinhoJob, "nano_id" | "horario_registro" | "vaga_encerrada">> = [];

  for (let page = 0; page < maxPages; page += 1) {
    const data = await fetchJson<MeuPadrinhoListResponse>(`${BASE_URL}/vagas?page=${page}`);
    const vagas = data.vagas ?? [];
    listItems.push(
      ...vagas.filter((job) => !job.vaga_encerrada && isAfterSince(job.horario_registro, options.since))
    );

    if (!data.tem_proxima_pagina || vagas.length === 0) break;
  }

  const limit = pLimit(4);
  const details = await Promise.all(
    listItems.map((item) =>
      limit(async () => {
        const detail = await fetchJson<MeuPadrinhoJob>(`${BASE_URL}/vagas/${item.nano_id}`);
        return {
          source: "meupadrinho" as const,
          externalId: detail.nano_id,
          raw: detail
        };
      })
    )
  );

  return details;
}
