import { describe, expect, it } from "vitest";
import { isTechRemotarJob } from "./remotar.parser.js";

describe("isTechRemotarJob", () => {
  it("keeps jobs in technology categories", () => {
    expect(
      isTechRemotarJob({
        id: 1,
        title: "Pessoa Desenvolvedora Backend",
        description: "",
        jobTags: [],
        jobCategories: [{ category: { id: 13, name: "Programação" } }],
      }),
    ).toBe(true);
  });

  it("keeps jobs with developer or QA terms even when category is broad", () => {
    expect(
      isTechRemotarJob({
        id: 2,
        title: "QA Automation Engineer",
        description: "<p>Selenium, Cypress, API testing</p>",
        jobTags: [],
        jobCategories: [{ category: { name: "Outros" } }],
      }),
    ).toBe(true);
  });

  it("drops non-tech jobs", () => {
    expect(
      isTechRemotarJob({
        id: 3,
        title: "Executivo de Vendas",
        description: "Prospecção e negociação",
        jobTags: [],
        jobCategories: [{ category: { name: "Vendas" } }],
      }),
    ).toBe(false);
  });

  it("does not keep sales jobs only because the description mentions data or digital", () => {
    expect(
      isTechRemotarJob({
        id: 4,
        title: "Ad Sales Executive",
        description: "Digital media, behavioral data, and advertising strategy.",
        jobTags: [],
        jobCategories: [{ category: { name: "Vendas & Negócios" } }],
      }),
    ).toBe(false);
  });

  it("drops marketplace and marketing jobs even when Remotar tags them as product", () => {
    expect(
      isTechRemotarJob({
        id: 85175,
        title: "Estágio de Marketplace | Canais Digitais",
        description: "Interesse em automação e uso de tecnologia, IA e ferramentas digitais.",
        jobTags: [{ tag: { name: "🐣 Estágio" } }],
        jobCategories: [{ category: { id: 15, name: "Produto" } }, { category: { id: 10, name: "Marketing" } }],
      }),
    ).toBe(false);
  });

  it("does not accept broad programming category when the title is advisory or sales oriented", () => {
    expect(
      isTechRemotarJob({
        id: 135701,
        title: "Technical Advisor",
        description: "Atuar com clientes, desenho de soluções e apoio ao time de vendas.",
        jobTags: [{ tag: { name: "100% Remoto" } }],
        jobCategories: [{ category: { id: 13, name: "Programação" } }],
      }),
    ).toBe(false);
  });

  it("keeps system analyst, architect, product owner, and tech lead roles in broad programming category", () => {
    expect(
      isTechRemotarJob({
        id: 1,
        title: "Analista de Sistemas Sênior",
        jobCategories: [{ category: { id: 13, name: "Programação" } }],
      }),
    ).toBe(true);
    expect(
      isTechRemotarJob({
        id: 2,
        title: "Arquiteto de Software",
        jobCategories: [{ category: { id: 13, name: "Programação" } }],
      }),
    ).toBe(true);
    expect(
      isTechRemotarJob({
        id: 5,
        title: "Arquiteto de Dados",
        jobCategories: [{ category: { id: 13, name: "Programação" } }],
      }),
    ).toBe(true);
    expect(
      isTechRemotarJob({
        id: 3,
        title: "PO - Product Owner Pleno",
        jobCategories: [{ category: { id: 13, name: "Programação" } }],
      }),
    ).toBe(true);
    expect(
      isTechRemotarJob({
        id: 4,
        title: "Tech Lead Sênior",
        jobCategories: [{ category: { id: 13, name: "Programação" } }],
      }),
    ).toBe(true);
  });
});
