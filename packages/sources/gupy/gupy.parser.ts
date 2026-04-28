import {
  detectSeniority,
  detectWorkMode,
  extractStack,
  formatLocation,
  parseDate,
  stripHtml
} from "../../core/normalize-job.js";
import type { JobDTO, WorkMode } from "../../core/types.js";

import { z } from "zod";

export const gupyJobSchema = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  careerPageName: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  publishedDate: z.string().nullable().optional(),
  applicationDeadline: z.string().nullable().optional(),
  isRemoteWork: z.boolean().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  jobUrl: z.string().nullable().optional(),
  workplaceType: z.string().nullable().optional(),
  workplaceTypes: z.array(z.string()).nullable().optional(),
  badges: z.object({
    friendlyBadge: z.boolean().optional(),
    isPWD: z.boolean().optional()
  }).nullable().optional(),
  skills: z.array(
    z.union([
      z.string(),
      z.object({ name: z.string().nullable().optional() })
    ])
  ).nullable().optional()
});

export type GupyJob = z.infer<typeof gupyJobSchema>;

const CORE_TECH_TITLE_PATTERNS = [
  /\bqa\b/i,
  /\bq\.?a\.?\b/i,
  /quality assurance/i,
  /analista (de )?testes?/i,
  /engenheir[oa] de testes/i,
  /testes? de software/i,
  /testes? de sistemas/i,
  /automatizador de testes/i,
  /estagi[aá]ri[oa].*testes?.*(web|api|software|sistemas)/i,
  /automa[cç][aã]o.*testes?/i,
  /test automation/i,
  /desenvolvedor/i,
  /desenvolvedora/i,
  /\bdev\b/i,
  /developer/i,
  /engenheir[ao].*(software|dados|data|sre|devops|cloud|seguran[cç]a)/i,
  /software engineer/i,
  /frontend|front-end/i,
  /backend|back-end/i,
  /fullstack|full stack/i,
  /mobile/i,
  /android|ios/i,
  /data (engineer|scientist|analyst|analytics)/i,
  /cientista de dados/i,
  /analista de dados/i,
  /engenharia de dados/i,
  /devops/i,
  /\bsre\b/i,
  /cloud/i,
  /seguran[cç]a (cibern[eé]tica|da informa[cç][aã]o)/i,
  /cyber/i,
];

const SECONDARY_TECH_TITLE_PATTERNS = [
  /product manager/i,
  /product owner/i,
  /\bpo\b/i,
  /\bdba\b|banco de dados/i,
  /analista de (bi|dados|data)/i,
  /analista dados/i,
  /governan[cç]a de dados/i,
  /especialista (em |de )?dados/i,
  /engenh(eir|aria).*dados/i,
  /cientista.*dados/i,
  /arquiteto.*dados/i,
  /gerente de dados|l[ií]der de dados|head de dados/i,
  /tech lead.*dados/i,
  /data (engineer|scientist|analyst|analytics|platform|product|architecture|insights)/i,
  /data science|analytics engineer|web analytics|business analytics/i,
  /business intelligence|\bbi\b/i,
  /scrum master/i,
  /agile/i,
  /ui\/ux|ux\/ui|ux designer|ui designer|designer ux|designer ui|product designer/i
];

const EXCLUDED_TITLE_PATTERNS = [
  /recursos humanos|\brh\b|recruiter|recrutamento|talent acquisition/i,
  /marketing|marketplace|growth|crm/i,
  /vendas?|comercial|business development/i,
  /customer success|atendimento|suporte ao cliente/i,
  /financeiro|cont[aá]bil|jur[ií]dico/i
];

const BUSINESS_EXCLUDED_TITLE_PATTERNS = [
  /recursos humanos|\brh\b|recruiter|recrutamento|talent acquisition/i,
  /marketplace|growth|crm/i,
  /vendas?|comercial|business development|pr[eé][ -]?vendas/i,
  /customer success|atendimento|suporte ao cliente/i,
  /marketing/i
];

const EXPLICIT_TECH_OVERRIDE_PATTERNS = [
  /\bqa\b/i,
  /quality assurance/i,
  /analista de testes/i,
  /desenvolvedor|desenvolvedora|developer|\bdev\b/i,
  /software engineer|engenharia de software/i,
  /frontend|front-end|backend|back-end|fullstack|full stack|mobile|android|ios/i
];

const detectGupyWorkMode = (job: GupyJob): WorkMode => {
  const workplaceValues = [job.workplaceType, ...(job.workplaceTypes ?? [])].join(" ");
  return job.isRemoteWork ? "remote" : detectWorkMode(workplaceValues);
};

const getSkillTags = (job: GupyJob): string[] =>
  (job.skills ?? [])
    .map((skill) => (typeof skill === "string" ? skill : skill.name))
    .filter((skill): skill is string => Boolean(skill?.trim()))
    .map((skill) => skill.trim());

const isExpired = (deadline: string | null | undefined): boolean => {
  if (!deadline) return false;
  const deadlineDate = parseDate(deadline);
  if (!deadlineDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endOfDeadline = new Date(deadlineDate);
  endOfDeadline.setHours(23, 59, 59, 999);

  return endOfDeadline < today;
};

export const isTechGupyJob = (job: GupyJob): boolean => {
  if (isExpired(job.applicationDeadline)) {
    return false;
  }

  const title = job.name ?? "";
  if (
    BUSINESS_EXCLUDED_TITLE_PATTERNS.some((pattern) => pattern.test(title)) &&
    !EXPLICIT_TECH_OVERRIDE_PATTERNS.some((pattern) => pattern.test(title))
  ) {
    return false;
  }

  if (CORE_TECH_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return true;
  }

  if (EXCLUDED_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return false;
  }

  return SECONDARY_TECH_TITLE_PATTERNS.some((pattern) => pattern.test(title));
};

export const normalizeGupyJob = (job: GupyJob): JobDTO => {
  const workMode = detectGupyWorkMode(job);
  const description = stripHtml(job.description ?? "");
  const skillTags = getSkillTags(job);
  const stack = extractStack([job.name, skillTags.join(" ")]);
  const location = formatLocation(job.city, job.state, job.country);
  const publishedAt = parseDate(job.publishedDate);

  return {
    source: "gupy",
    externalId: String(job.id),
    title: (job.name ?? "").trim(),
    company: (job.careerPageName ?? "Empresa não informada").trim(),
    location,
    workMode,
    seniority: detectSeniority(`${job.name ?? ""} ${skillTags.join(" ")}`),
    url: job.jobUrl ?? `https://portal.gupy.io/job-search/term=${job.id}`,
    description: description || undefined,
    stack,
    publishedAt,
    scrapedAt: new Date()
  };
};
