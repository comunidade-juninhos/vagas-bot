import { describe, expect, it } from "vitest";
import {
  detectApplySourceFromUrl,
  getSourceColor,
  getSourceEmoji,
  getSourceLabel,
} from "./source.js";

describe("source helpers", () => {
  it("detects the application platform from job URLs", () => {
    expect(detectApplySourceFromUrl("https://bradesco.gupy.io/jobs/123")).toBe("gupy");
    expect(detectApplySourceFromUrl("https://www.linkedin.com/jobs/view/123")).toBe("linkedin");
    expect(detectApplySourceFromUrl("https://www.indeed.com.br/viewjob?jk=123")).toBe("indeed");
    expect(detectApplySourceFromUrl("https://remotar.com.br/jobs/123")).toBe("remotar");
    expect(detectApplySourceFromUrl("https://meupadrinho.com.br/vaga/abc")).toBe("meupadrinho");
    expect(detectApplySourceFromUrl("https://boards.greenhouse.io/acme/jobs/123")).toBe("greenhouse");
    expect(detectApplySourceFromUrl("https://jobs.lever.co/acme/123")).toBe("lever");
    expect(detectApplySourceFromUrl("https://empresa.com/careers/backend")).toBe("company-site");
  });

  it("returns display metadata for sources", () => {
    expect(getSourceLabel("gupy")).toBe("Gupy");
    expect(getSourceEmoji("gupy")).toBe("💚");
    expect(getSourceColor("gupy")).toBe("#10B981");
    expect(getSourceLabel("company-site")).toBe("Site da empresa");
  });
});
