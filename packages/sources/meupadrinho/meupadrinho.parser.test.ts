import { describe, expect, it } from "vitest";
import { normalizeMeuPadrinhoJob } from "./meupadrinho.parser.js";

describe("normalizeMeuPadrinhoJob", () => {
  it("normalizes a Meu Padrinho detail response into JobDTO", () => {
    const job = normalizeMeuPadrinhoJob({
      titulo_vaga: "MLOps Engineer (Remote)",
      local: "Brasil",
      horario_registro: "2026-04-30T14:27:48.54452",
      link_vaga: "https://br.linkedin.com/jobs/view/mlops-engineer-remote-at-hire-feed-4409037231",
      plataforma: "LINKEDIN",
      forma_trabalho: "remoto",
      cargo: "IA",
      nivel: "Pleno",
      nano_id: "0yUsOIUt",
      slug: "mlops-engineer-remote",
      descricao_vaga: "Engenheiro de MLOps remoto responsável por projetar agentes de IA.",
      requisitos_tecnicos: "Python; SQL; construção de software modular",
      beneficios_empresa: "remoto; pagamento semanal",
      requisitos_desejaveis: "Supabase; Gmail APIs",
      tipo_contrato: "PJ",
      nome_empresa: "Hire Feed",
      vaga_encerrada: false
    });

    expect(job).toMatchObject({
      source: "meupadrinho",
      externalId: "0yUsOIUt",
      title: "MLOps Engineer (Remote)",
      company: "Hire Feed",
      location: "Brasil",
      workMode: "remote",
      seniority: "mid",
      url: "https://br.linkedin.com/jobs/view/mlops-engineer-remote-at-hire-feed-4409037231",
    });
    expect(job.stack).toEqual(expect.arrayContaining(["ai", "api", "python", "sql"]));
    expect(job.description).toContain("Requisitos: Python; SQL; construção de software modular");
    expect(job.description).toContain("Benefícios: remoto; pagamento semanal");
    expect(job.publishedAt?.toISOString()).toBe("2026-04-30T17:27:48.544Z");
  });

  it("falls back to the public Meu Padrinho route when the original link is missing", () => {
    const job = normalizeMeuPadrinhoJob({
      titulo_vaga: "Dev Java Fullstack",
      empresa_nome: "ExpertaSYS",
      horario_registro: "2026-04-30T11:27:32.643679",
      forma_trabalho: "presencial",
      cargo: "FULLSTACK",
      nivel: "",
      nano_id: "HSoggKdy",
      slug: "dev-java-fullstack",
      vaga_encerrada: false
    });

    expect(job.url).toBe("https://meupadrinho.com.br/vaga/HSoggKdy");
    expect(job.company).toBe("ExpertaSYS");
    expect(job.workMode).toBe("onsite");
  });

  it("preserves structured Meu Padrinho fields for clean bot messages", () => {
    const job = normalizeMeuPadrinhoJob({
      titulo_vaga: "Desenvolvedor Backend Júnior",
      local: "Salvador, BA",
      horario_registro: "2026-04-30T10:26:03.745759",
      link_vaga: "https://br.linkedin.com/jobs/view/desenvolvedor-backend-j%C3%BAnior-at-escavador-4408788665",
      plataforma: "LINKEDIN",
      forma_trabalho: "remoto",
      cargo: "BACKEND",
      nivel: "Junior",
      nivel_vaga: "Júnior",
      nano_id: "LJlZ6BSy",
      slug: "desenvolvedor-backend-junior",
      descricao_vaga: "Desenvolvedor Backend Júnior com foco em Python para design e manutenção de pipelines de dados, web scraping, APIs e processamento assíncrono.",
      requisitos_tecnicos: "Python; padrões de projeto; bancos de dados SQL; desenvolvimento de APIs; Git; processamento assíncrono/concorrente em Python; Docker; desenvolvimento orientado a testes; leitura de materiais em inglês",
      beneficios_empresa: "Plano de saúde SulAmérica; Plano odontológico SulAmérica",
      requisitos_desejaveis: "",
      tipo_contrato: "CLT",
      salario: "4.860,00",
      nome_empresa: "Escavador",
      vaga_encerrada: false
    });

    expect(job).toMatchObject({
      source: "meupadrinho",
      externalId: "LJlZ6BSy",
      title: "Desenvolvedor Backend Júnior",
      company: "Escavador",
      location: "Salvador, BA",
      workMode: "remote",
      seniority: "junior",
    });
    expect(job.stack).toEqual(expect.arrayContaining(["backend", "python", "sql", "api", "git", "docker", "asyncio", "testing", "web-scraping"]));
    expect(job.description).toContain("Requisitos: Python; padrões de projeto; bancos de dados SQL");
    expect(job.description).toContain("Contrato: CLT");
    expect(job.description).toContain("Nível: Júnior");
    expect(job.description).toContain("Salário: 4.860,00");
  });
});
