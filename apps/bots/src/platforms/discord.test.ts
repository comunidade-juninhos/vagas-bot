import { describe, expect, it } from "vitest";
import { buildDiscordJobPayload } from "./discord.js";

describe("buildDiscordJobPayload", () => {
  it("builds a rich Discord embed with structured fields", async () => {
    const payload = await buildDiscordJobPayload({
      source: "gupy",
      title: "Desenvolvedor Full Stack Sênior (C#, Angular, Azure)",
      company: "Extractta",
      location: "Brasil",
      workMode: "remote",
      seniority: "senior",
      url: "https://extractta.gupy.io/jobs/123",
      description:
        "Estamos em busca de profissionais de desenvolvimento de software com perfil sênior, que tenham paixão por tecnologia. Requisitos e qualificaçõesSólida experiência com C# e .NET 8. Experiência com desenvolvimento front-end utilizando Angular. Conhecimentos em Azure Service Bus. Benefícios: contratação PJ.",
      stack: ["azure", "cloud", "fullstack", "Docker", "Kubernetes", "SQL", "Angular", ".NET", "Azure"],
      publishedAt: new Date("2026-04-28T10:00:00.000Z"),
      scrapedAt: new Date("2026-04-30T12:00:00.000Z")
    });

    const embed = payload.embeds[0].toJSON();

    // title has emoji prefix
    expect(embed.title).toBe("🚀 Desenvolvedor Full Stack Sênior (C#, Angular, Azure)");
    expect(embed.description).toContain("Extractta");
    expect(embed.description).toContain("🌍");
    expect(embed.description).toContain("Remoto");

    // should have stack field with code-formatted techs
    const stackField = embed.fields.find((f) => f.name === "🛠️ Tecnologias");
    expect(stackField).toBeDefined();
    expect(stackField.value).toContain("`Azure`");
    expect(stackField.value).toContain("`Docker`");
    expect(stackField.value).toContain("`SQL`");
    expect(stackField.value).toContain("`Angular`");
    expect(stackField.value).toContain("`.NET`");

    // should have requirements field with bullet points
    const reqField = embed.fields.find((f) => f.name === "📋 Requisitos");
    expect(reqField).toBeDefined();
    expect(reqField.value).toContain("•");

    // should have published date field
    // footer has source label
    expect(embed.footer.text).toContain("Gupy");
    expect(embed.footer.text).toContain("Publicada em 28/04/2026");

    // button row
    expect(payload.components).toHaveLength(1);
  });

  it("formats Meu Padrinho security jobs with proper fields", async () => {
    const payload = await buildDiscordJobPayload({
      source: "meupadrinho",
      title: "Analista de Segurança da Informação SR - CSIRT",
      company: "Bradesco",
      location: "Osasco, SP",
      workMode: "hybrid",
      seniority: "senior",
      url: "https://meupadrinho.com.br/vaga/bradesco-csirt",
      description: `
Sendo Cyber Security Engineer III, atuará na gerência CSIRT.

Requisitos e Qualificações

     Graduação em Ciência da Computação, Engenharia, Segurança da Informação ou áreas correlatas;
     Experiência comprovada em resposta e análise de incidentes de segurança;
     Conhecimento avançado em ferramentas de segurança (Ex: IPS, EDR, NDR, XDR, SIEM, SOAR, WAF, Soluções Anti-DDoS);
     Conhecimento das normas ISO/IEC 27001/27035;
     Conhecimento dos principais FrameWorks de mercado NIST e SANS;
     Inglês técnico para leitura de documentação.

Será um diferencial se você tiver:
     Certificações de cibersegurança.
`,
      stack: ["aws", "cloud", "cybersecurity"],
      scrapedAt: new Date("2026-04-30T12:00:00.000Z")
    });

    const embed = payload.embeds[0].toJSON();

    // no false language noise
    expect(embed.description).not.toContain("Idioma detectado");

    // has hybrid mode with location
    expect(embed.description).toContain("Híbrido");
    expect(embed.description).toContain("Osasco, SP");

    // stack field shows security techs
    const stackField = embed.fields.find((f) => f.name === "🛠️ Tecnologias");
    expect(stackField).toBeDefined();
    expect(stackField.value).toContain("Cybersecurity");
    expect(stackField.value).toContain("NIST");
    expect(stackField.value).toContain("SANS");

    // requirements field has bullet-pointed items
    const reqField = embed.fields.find((f) => f.name === "📋 Requisitos");
    expect(reqField).toBeDefined();
    expect(reqField.value).toContain("Graduação em Ciência da Computação");

    // footer uses the application platform, detected from URL
    expect(embed.footer.text).toContain("Meu Padrinho");
  });

  it("shows the application platform in the footer when URL points to Gupy", async () => {
    const payload = await buildDiscordJobPayload({
      source: "meupadrinho",
      title: "Cyber Security Engineer III",
      company: "Bradesco",
      location: "São Paulo, SP",
      workMode: "hybrid",
      seniority: "mid",
      url: "https://bradesco.gupy.io/jobs/123",
      description:
        "Atuação em CSIRT com monitoramento, resposta a incidentes e automações de segurança. Requisitos e Qualificações Experiência com resposta e análise de incidentes. Inglês técnico. Benefícios: vale refeição.",
      stack: ["cybersecurity", "siem", "soar", "edr", "waf", "aws"],
      publishedAt: new Date("2026-04-27T00:00:00.000Z"),
      scrapedAt: new Date("2026-04-30T12:00:00.000Z")
    });

    const embed = payload.embeds[0].toJSON();

    expect(embed.description).not.toContain("Salário não informado");
    expect(embed.description).toContain("🏠 Híbrido • 📍 São Paulo, SP • 💼 Pleno");
    expect(embed.description).toContain("> Atuação em CSIRT");
    expect(embed.fields?.some((field) => field.name === "📝 Resumo")).toBe(false);
    expect(embed.footer.text).toBe("💚 Gupy • vagas-bot • Publicada em 27/04/2026");
    expect(embed.footer.text).not.toContain("Meu Padrinho");
    expect(payload.components[0].components[0].data.url).toBe("https://bradesco.gupy.io/jobs/123");
  });

  it("omits unknown work mode from the metadata line", async () => {
    const payload = await buildDiscordJobPayload({
      source: "linkedin",
      title: "PROCESSO SELETIVO N° 001/2022 – ANALISTA DE SUPORTE AO NEGÓCIO I – TI",
      company: "EMBRAPII",
      location: "Brasília, DF",
      workMode: "unknown",
      seniority: "junior",
      url: "https://www.linkedin.com/jobs/view/123",
      description: "Oportunidade para Analista de Suporte ao Negócio I – TI.",
      stack: [],
      scrapedAt: new Date("2026-05-01T07:29:00.000Z")
    });

    const embed = payload.embeds[0].toJSON();

    expect(embed.description).toContain("📍 Brasília, DF • 🌱 Júnior");
    expect(embed.description).not.toContain("Não informado");
  });
});
