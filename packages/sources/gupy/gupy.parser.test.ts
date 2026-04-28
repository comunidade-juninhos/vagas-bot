import { describe, expect, it } from "vitest";
import { isTechGupyJob, normalizeGupyJob } from "./gupy.parser.js";

const baseJob = {
  id: 11207075,
  name: "QA Automação Sr - Segmento Financeiro",
  description: "Automação de testes com Cypress e API testing.",
  careerPageName: "DB",
  type: "vacancy_type_effective",
  publishedDate: "2026-04-28T14:04:54.151Z",
  applicationDeadline: "2026-06-27",
  isRemoteWork: true,
  city: "",
  state: "",
  country: "Brasil",
  jobUrl: "https://db.gupy.io/job/abc?jobBoardSource=gupy_portal",
  workplaceType: "remote",
  badges: { friendlyBadge: true, isPWD: true },
  skills: []
};

describe("normalizeGupyJob", () => {
  it("normalizes a Gupy job into the shared job shape", () => {
    const job = normalizeGupyJob(baseJob);

    expect(job).toMatchObject({
      source: "gupy",
      externalId: "11207075",
      title: "QA Automação Sr - Segmento Financeiro",
      company: "DB",
      description: "Automação de testes com Cypress e API testing",
      location: "Brasil",
      workMode: "remote",
      seniority: "senior",
      url: "https://db.gupy.io/job/abc?jobBoardSource=gupy_portal",
      stack: ["qa"]
    });
    expect(job.publishedAt?.toISOString()).toBe("2026-04-28T14:04:54.151Z");
    expect(job.scrapedAt).toBeInstanceOf(Date);
    expect(job).not.toHaveProperty("raw");
    expect(job).not.toHaveProperty("tags");
  });
});

describe("isTechGupyJob", () => {
  it("keeps developer, QA, data, product and related technology roles", () => {
    expect(isTechGupyJob(baseJob)).toBe(true);
    expect(isTechGupyJob({ ...baseJob, name: "Pessoa Desenvolvedora Backend Java" })).toBe(true);
    expect(isTechGupyJob({ ...baseJob, name: "Product Manager Plataforma" })).toBe(true);
    expect(isTechGupyJob({ ...baseJob, name: "Product Owner" })).toBe(true);
    expect(isTechGupyJob({ ...baseJob, name: "Analista de BI/Dados" })).toBe(true);
    expect(isTechGupyJob({ ...baseJob, name: "ANALISTA TESTES PL" })).toBe(true);
    expect(isTechGupyJob({ ...baseJob, name: "Analista Automatizador de Testes Júnior" })).toBe(true);
    expect(isTechGupyJob({ ...baseJob, name: "Analista de Q.A Jr (Testes de Sistemas)" })).toBe(true);
    expect(isTechGupyJob({ ...baseJob, name: "Administrador de Banco de Dados SR" })).toBe(true);
    expect(isTechGupyJob({ ...baseJob, name: "ANALISTA DADOS SR" })).toBe(true);
    expect(isTechGupyJob({ ...baseJob, name: "Especialista de Dados e Performance" })).toBe(true);
    expect(isTechGupyJob({ ...baseJob, name: "Tech Lead - Open Finance (Foco em Dados)" })).toBe(true);
    expect(isTechGupyJob({ ...baseJob, name: "UX/UI Designer - Sênior" })).toBe(true);
  });

  it("drops unrelated roles", () => {
    expect(
      isTechGupyJob({
        ...baseJob,
        name: "Assistente Administrativo",
        description: "Rotinas administrativas e atendimento interno."
      })
    ).toBe(false);
  });

  it("does not keep business roles only because they contain test or data center terms", () => {
    expect(isTechGupyJob({ ...baseJob, name: "|LOJAS YOUCOM| Consultor de Vendas - Teste" })).toBe(false);
    expect(isTechGupyJob({ ...baseJob, name: "Engenheiro(a) de Vendas - Data center" })).toBe(false);
    expect(isTechGupyJob({ ...baseJob, name: "Consultor(a) de Pré Vendas Data Center e Cloud" })).toBe(false);
    expect(isTechGupyJob({ ...baseJob, name: "VAGA TESTE 10" })).toBe(false);
    expect(isTechGupyJob({ ...baseJob, name: "PILOTO DE TESTE" })).toBe(false);
  });

  it("keeps explicit developer roles even when the business area is financial or marketing", () => {
    expect(isTechGupyJob({ ...baseJob, name: "Web Developer Pleno | Marketing" })).toBe(true);
    expect(isTechGupyJob({ ...baseJob, name: "QA Automação Sr - Segmento Financeiro" })).toBe(true);
  });

  it("drops HR roles even when the description mentions systems or automation", () => {
    expect(
      isTechGupyJob({
        ...baseJob,
        name: "Analista de Recursos Humanos Tech Recruiter",
        description: "Atuar com sistemas, automação e ferramentas digitais para recrutamento."
      })
    ).toBe(false);
  });

  it("drops business data roles that are not technology roles", () => {
    expect(isTechGupyJob({ ...baseJob, name: "Analista de Marketing Jr. - Foco em Dados e Performance" })).toBe(false);
    expect(isTechGupyJob({ ...baseJob, name: "ANALISTA ADM VENDAS PLENO - INTELIGÊNCIA DE DADOS" })).toBe(false);
    expect(isTechGupyJob({ ...baseJob, name: "Analista de FP&A Pleno - Automações & Dados" })).toBe(false);
  });

  it("drops expired jobs even when the title is technical", () => {
    expect(isTechGupyJob({ ...baseJob, applicationDeadline: "2000-01-01" })).toBe(false);
  });
});
