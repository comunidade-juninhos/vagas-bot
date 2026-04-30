import { describe, expect, it } from "vitest";
import {
  cleanText,
  detectAndTranslate,
  extractRequirements,
  extractStacks,
  summarizeText
} from "./formatter.js";

const bradescoSecurityJob = `
Sobre a vaga

Responsabilidades e atribuições

Sendo Cyber Security Engineer III, atuará na gerência CSIRT e suas principais atividades serão:

     Monitorar e mitigar eventos em tempo real via SIEM, SOAR, EDR, NDR, XDR, IPS, WAF, Anti-DDoS entre outros;
     Identificar padrões suspeitos e comportamentos anômalos;
     Criar e validar fluxos de respostas automáticas via SIEM/SOAR.

 Requisitos e Qualificações

O que você precisa ter ou saber?

     Graduação em Ciência da Computação, Engenharia, Segurança da Informação ou áreas correlatas;
     Experiência comprovada em resposta e análise de incidentes de segurança;
     Conhecimento avançado em ferramentas de segurança (Ex: IPS, EDR, NDR, XDR, SIEM, SOAR, WAF, Soluções Anti-DDoS);
     Habilidade para interpretar logs, metadados e pacotes de rede;
     Conhecimento das normas ISO/IEC 27001/27035;
     Conhecimento dos principais FrameWorks de mercado NIST e SANS;
     Inglês técnico para leitura de documentação.

Será um diferencial se você tiver:

     Certificações de cibersegurança (ex.: GCIH, CSA, CompTIA Security+/CySA+, CCFR, AZ-200, AWS SOA-C02);
`;

describe("formatter helpers", () => {
  it("cleans pasted job text without joining sentences awkwardly", () => {
    const text = cleanText("alto impacto.Buscamos pessoas\\n\\nRequisitos e qualificaçõesSólida experiência com C# e.NET 8.");

    expect(text).toBe("alto impacto. Buscamos pessoas Requisitos e qualificações Sólida experiência com C# e .NET 8.");
  });

  it("summarizes on a sentence boundary", () => {
    const summary = summarizeText(
      "Primeira frase com contexto relevante. Segunda frase com mais detalhes importantes. Terceira frase longa demais para entrar.",
      96
    );

    expect(summary).toBe("Primeira frase com contexto relevante. Segunda frase com mais detalhes importantes.");
  });

  it("extracts clean requirements without section headers", () => {
    const requirements = extractRequirements(
      "Resumo da vaga. Requisitos e qualificaçõesSólida experiência com C# e .NET 8. Experiência com Angular. Conhecimentos em Azure Service Bus. Benefícios: vale refeição."
    );

    expect(requirements).toBe("Sólida experiência com C# e .NET 8. Experiência com Angular. Conhecimentos em Azure Service Bus.");
  });

  it("deduplicates stacks case-insensitively and prefers normalized labels", () => {
    const stacks = extractStacks("Projeto com Azure, Docker e SQL.", ["azure", "cloud", "Docker", ".NET", "Azure"]);

    expect(stacks).toEqual(["Azure", "Cloud", "Docker", "SQL", ".NET"]);
  });

  it("keeps Portuguese security jobs as Portuguese", async () => {
    const { detectedLang } = await detectAndTranslate(bradescoSecurityJob);

    expect(detectedLang).toBe("pt");
  });

  it("extracts the full requirements block before differentials", () => {
    const requirements = extractRequirements(bradescoSecurityJob);

    expect(requirements).toContain("Graduação em Ciência da Computação");
    expect(requirements).toContain("Experiência comprovada em resposta e análise de incidentes de segurança");
    expect(requirements).toContain("SIEM");
    expect(requirements).toContain("SOAR");
    expect(requirements).toContain("EDR");
    expect(requirements).toContain("NDR");
    expect(requirements).toContain("XDR");
    expect(requirements).toContain("IPS");
    expect(requirements).toContain("WAF");
    expect(requirements).toContain("Soluções Anti-DDoS");
    expect(requirements).toContain("ISO/IEC 27001/27035");
    expect(requirements).toContain("NIST e SANS");
    expect(requirements).toContain("Inglês técnico");
    expect(requirements).not.toContain("Certificações de cibersegurança");
  });

  it("extracts security stack labels from requirements", () => {
    const stacks = extractStacks(bradescoSecurityJob, ["aws", "cloud", "cybersecurity"]);

    expect(stacks).toEqual(expect.arrayContaining([
      "AWS",
      "Cloud",
      "Cybersecurity",
      "SIEM",
      "SOAR",
      "EDR",
      "NDR",
      "XDR",
      "WAF",
      "Anti-DDoS",
      "NIST",
      "SANS",
      "ISO 27001",
    ]));
  });

  it("splits Meu Padrinho compact stack text into readable labels", () => {
    const stacks = extractStacks("PythonSQLAPIsGitDockerAsyncioTestingWeb Scraping", []);

    expect(stacks).toEqual(expect.arrayContaining(["Python", "SQL", "APIs", "Git", "Docker", "Asyncio", "Testing", "Web Scraping"]));
  });
});
