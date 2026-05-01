import { describe, expect, it } from "vitest";
import { buildNotificationJob } from "./notification.js";
import type { JobDTO } from "./types.js";

const job = (overrides: Partial<JobDTO> = {}): JobDTO => ({
  source: "meupadrinho",
  externalId: "abc",
  title: "Cyber Security Engineer III",
  company: "Bradesco",
  location: "São Paulo, SP",
  workMode: "hybrid",
  seniority: "mid",
  url: "https://bradesco.gupy.io/jobs/123",
  description: `
Sobre a vaga

Atuação em CSIRT com monitoramento, resposta a incidentes e automações de segurança.

Requisitos e Qualificações
Experiência com resposta e análise de incidentes.
Conhecimento em SIEM, SOAR, EDR, NDR, XDR, IPS e WAF.
Inglês técnico.
Benefícios: vale refeição.
`,
  stack: ["cybersecurity", "siem", "soar", "edr", "waf", "aws"],
  publishedAt: new Date("2026-04-27T00:00:00.000Z"),
  scrapedAt: new Date("2026-04-30T12:00:00.000Z"),
  ...overrides,
});

describe("buildNotificationJob", () => {
  it("cleans noisy source text for notification display", () => {
    const notification = buildNotificationJob(
      job({
        title: "Python/ Angular Full-Stack Developer | Mid (Remoto)",
        company: "Compass. uol",
        description:
          "Desenvolvedor full-stack com Node. js, Type Script, Postgre SQL, Saa S e Learn With. AI. Requisitos: APIs REST; Postgre SQL; Node. js. Desejáveis: experiência com AWS.",
      }),
    );

    expect(notification.company).toBe("Compass.uol");
    expect(notification.summary).toContain("Node.js");
    expect(notification.summary).toContain("TypeScript");
    expect(notification.summary).toContain("PostgreSQL");
    expect(notification.summary).toContain("SaaS");
    expect(notification.summary).toContain("Learn With.AI");
    expect(notification.requirementBullets).toEqual(["APIs REST", "PostgreSQL", "Node.js"]);
  });

  it("uses the application platform as the displayed source", () => {
    const notification = buildNotificationJob(job());

    expect(notification.source).toBe("gupy");
    expect(notification.sourceLabel).toBe("Gupy");
    expect(notification.sourceEmoji).toBe("💚");
    expect(notification.sourceColor).toBe("#10B981");
  });

  it("normalizes display labels and limits notification-heavy fields", () => {
    const notification = buildNotificationJob(
      job({
        stack: [
          "cybersecurity",
          "siem",
          "soar",
          "edr",
          "waf",
          "aws",
          "docker",
          "kubernetes",
          "terraform",
          "python",
          "node",
          "typescript",
          "react",
          "sql",
          "redis",
          "kafka",
        ],
      }),
    );

    expect(notification.workModeLabel).toBe("Híbrido");
    expect(notification.workModeEmoji).toBe("🏠");
    expect(notification.seniorityLabel).toBe("Pleno");
    expect(notification.seniorityEmoji).toBe("💼");
    expect(notification.salaryLabel).toBeUndefined();
    expect(notification.stackLabels).toHaveLength(16);
    expect(notification.stackLabels).toEqual(
      expect.arrayContaining(["Cybersecurity", "SIEM", "SOAR", "EDR", "WAF", "AWS"]),
    );
    expect(notification.requirementBullets).toEqual([
      "Experiência com resposta e análise de incidentes",
      "Conhecimento em SIEM, SOAR, EDR, NDR, XDR, IPS e WAF",
      "Inglês técnico",
    ]);
    expect(notification.publishedAtLabel).toBe("27/04/2026");
  });

  it("marks non-Portuguese jobs as international", () => {
    const notification = buildNotificationJob(
      job({
        source: "company-site",
        url: "https://remote-company.com/careers/backend",
        title: "Backend Engineer",
        company: "Remote Company",
        location: "United States / Remote",
        workMode: "remote",
        seniority: "junior",
        language: "en",
        salaryText: "USD 3.000 - 5.000",
      }),
    );

    expect(notification.isInternational).toBe(true);
    expect(notification.internationalLabel).toBe("🌎 Vaga internacional");
    expect(notification.salaryLabel).toBe("USD 3.000 - 5.000");
  });

  it("omits unknown work mode from display metadata", () => {
    const notification = buildNotificationJob(
      job({
        workMode: "unknown",
        seniority: "unknown",
        description: "Vaga administrativa de TI.",
      }),
    );

    expect(notification.workModeLabel).toBeUndefined();
    expect(notification.workModeEmoji).toBeUndefined();
    expect(notification.seniorityLabel).toBeUndefined();
  });
});
