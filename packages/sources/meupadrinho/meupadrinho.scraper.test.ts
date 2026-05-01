import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMeuPadrinhoJobs } from "./meupadrinho.scraper.js";

const listJob = (nano_id: string, cargo = "BACKEND") => ({
  nano_id,
  horario_registro: "2026-05-01T12:00:00.000000",
  vaga_encerrada: false,
  cargo,
});

const detailJob = (nano_id: string) => ({
  nano_id,
  titulo_vaga: `Vaga ${nano_id}`,
  nome_empresa: "Acme",
  horario_registro: "2026-05-01T12:00:00.000000",
  vaga_encerrada: false,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchMeuPadrinhoJobs", () => {
  it("broadens the first page by configured cargo filters and dedupes details", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = new URL(String(url));
      const path = requestUrl.pathname;

      if (path.startsWith("/api/vagas/")) {
        const id = path.split("/").at(-1) ?? "";
        return new Response(JSON.stringify(detailJob(id)), { status: 200 });
      }

      const cargo = requestUrl.searchParams.get("cargos");
      if (cargo === "QA") {
        return new Response(JSON.stringify({
          vagas: [listJob("job-b", "QA"), listJob("job-c", "QA")],
          tem_proxima_pagina: false,
        }), { status: 200 });
      }

      return new Response(JSON.stringify({
        vagas: [listJob("job-a"), listJob("job-b")],
        tem_proxima_pagina: false,
      }), { status: 200 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const jobs = await fetchMeuPadrinhoJobs({ maxPages: 1, cargoFilters: ["QA"] });

    expect(jobs.map((job) => job.externalId)).toEqual(["job-a", "job-b", "job-c"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://meupadrinho.com.br/api/vagas?page=0&cargos=QA",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "accept-language": expect.stringContaining("pt-BR"),
          referer: "https://meupadrinho.com.br/vagas",
          "user-agent": expect.stringMatching(/^Mozilla\/5\.0 .*Firefox\//),
        }),
      }),
    );
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/vagas/job-b"))).toHaveLength(1);
  });

  it("keeps valid jobs when one detail request is rate limited", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = new URL(String(url));
      const path = requestUrl.pathname;

      if (path.endsWith("/job-rate-limited")) {
        return new Response("rate limited", { status: 429 });
      }

      if (path.startsWith("/api/vagas/")) {
        const id = path.split("/").at(-1) ?? "";
        return new Response(JSON.stringify(detailJob(id)), { status: 200 });
      }

      return new Response(JSON.stringify({
        vagas: [listJob("job-ok"), listJob("job-rate-limited")],
        tem_proxima_pagina: false,
      }), { status: 200 });
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    vi.stubGlobal("fetch", fetchMock);

    const jobs = await fetchMeuPadrinhoJobs({ maxPages: 1, detailRetries: 0 });

    expect(jobs.map((job) => job.externalId)).toEqual(["job-ok"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Skipping detail job-rate-limited"));
  });

  it("skips a list query that is rate limited instead of failing the worker", async () => {
    const fetchMock = vi.fn(async () => new Response("rate limited", { status: 429 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    vi.stubGlobal("fetch", fetchMock);

    const jobs = await fetchMeuPadrinhoJobs({ maxPages: 1, listRetries: 0 });

    expect(jobs).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Skipping list page 0"));
  });
});
