import { describe, expect, it } from "vitest";
import { buildDiscordJobPayload } from "./discord.js";

describe("buildDiscordJobPayload", () => {
  it("builds a compact Discord embed without duplicated noisy fields", async () => {
    const payload = await buildDiscordJobPayload({
      source: "gupy",
      title: "Desenvolvedor Full Stack Sênior (C#, Angular, Azure)",
      company: "Extractta",
      location: "Brasil",
      workMode: "remote",
      seniority: "senior",
      url: "https://example.com/job",
      description:
        "Estamos em busca de profissionais de desenvolvimento de software com perfil sênior, que tenham paixão por tecnologia. Requisitos e qualificaçõesSólida experiência com C# e .NET 8. Experiência com desenvolvimento front-end utilizando Angular. Conhecimentos em Azure Service Bus. Benefícios: contratação PJ.",
      stack: ["azure", "cloud", "fullstack", "Docker", "Kubernetes", "SQL", "Angular", ".NET", "Azure"],
      scrapedAt: new Date("2026-04-30T12:00:00.000Z")
    });

    const embed = payload.embeds[0].toJSON();

    expect(embed.author).toBeUndefined();
    expect(embed.title).toBe("Desenvolvedor Full Stack Sênior (C#, Angular, Azure)");
    expect(embed.description).toContain("Extractta");
    expect(embed.fields.map((field) => field.name)).toEqual(["Stack", "Requisitos"]);
    expect(embed.fields[0].value).toContain("Azure");
    expect(embed.fields[0].value).toContain("Docker");
    expect(embed.fields[0].value).toContain("SQL");
    expect(embed.fields[0].value).toContain("Angular");
    expect(embed.fields[0].value).toContain(".NET");
    expect(embed.fields[1].value).toBe("Sólida experiência com C# e .NET 8. Experiência com desenvolvimento front-end utilizando Angular. Conhecimentos em Azure Service Bus.");
    expect(embed.footer.text).toBe("GUPY");
    expect(payload.components).toHaveLength(1);
  });

  it("formats Meu Padrinho security jobs without false language noise", async () => {
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

    expect(embed.description).not.toContain("Idioma detectado");
    expect(embed.fields[0].value).toContain("Cybersecurity");
    expect(embed.fields[0].value).toContain("NIST");
    expect(embed.fields[0].value).toContain("SANS");
    expect(embed.fields[1].value).toContain("Graduação em Ciência da Computação");
    expect(embed.fields[1].value).toContain("Inglês técnico");
    expect(embed.fields[1].value).not.toContain("Certificações de cibersegurança");
  });
});
