import {
  detectSeniority,
  detectWorkMode,
  extractStack,
  formatLocation,
  parseDate,
  stripHtml,
} from "../../core/normalize-job.js";
import type { JobDTO } from "../../core/types.js";

import { z } from "zod";

export const remotarJobSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  externalLink: z.string().nullable().optional(),
  isExternalLink: z.boolean().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  country: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
  company: z
    .object({
      name: z.string().nullable().optional(),
      link: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  companyDisplayName: z.string().nullable().optional(),
  companyDisplayLink: z.string().nullable().optional(),
  jobTags: z
    .array(
      z.object({
        tag: z
          .object({
            id: z.number().nullable().optional(),
            name: z.string().nullable().optional(),
          })
          .nullable()
          .optional(),
      }),
    )
    .nullable()
    .optional(),
  jobCategories: z
    .array(
      z.object({
        category: z
          .object({
            id: z.number().nullable().optional(),
            name: z.string().nullable().optional(),
          })
          .nullable()
          .optional(),
      }),
    )
    .nullable()
    .optional(),
});

export type RemotarJob = z.infer<typeof remotarJobSchema>;

export const REMOTAR_TECH_CATEGORY_IDS = [4, 6, 7, 8, 9, 13, 14] as const;
const REMOTAR_TECH_CATEGORY_ID_SET = new Set<number>(REMOTAR_TECH_CATEGORY_IDS);

const TECH_TITLE_PATTERNS = [
  /\bdev\b/i,
  /desenvolvedor/i,
  /desenvolvedora/i,
  /developer/i,
  /engineer/i,
  /engenheir/i,
  /\bqa\b/i,
  /quality assurance/i,
  /tester/i,
  /testes?/i,
  /frontend/i,
  /front-end/i,
  /backend/i,
  /back-end/i,
  /fullstack/i,
  /full stack/i,
  /mobile/i,
  /react/i,
  /node/i,
  /typescript/i,
  /javascript/i,
  /python/i,
  /java\b/i,
  /php\b/i,
  /ruby/i,
  /golang/i,
  /\bbi\b|business intelligence/i,
  /dados/i,
  /data (engineer|scientist|analyst|analytics)/i,
  /devops/i,
  /sre\b/i,
  /cloud/i,
  /seguran[cç]a/i,
  /cyber/i,
  /analista de sistemas/i,
  /arquitet[oa] de (software|solu[cç][oõ]es|dados)/i,
  /product owner|\bpo\b/i,
  /tech lead/i,
];

const EXCLUDED_TITLE_PATTERNS = [
  /marketplace/i,
  /marketing/i,
  /vendas?/i,
  /comercial/i,
  /\bsales\b|business development|sourcing|technical advisor/i,
  /recursos humanos|\brh\b|recruiter|recrutamento/i,
  /customer success|atendimento|suporte ao cliente/i,
];

const cleanLabel = (value: string): string =>
  value
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/\s+/g, " ")
    .trim();

const getTags = (job: RemotarJob): string[] =>
  (job.jobTags ?? [])
    .map((item) => item.tag?.name)
    .filter((name): name is string => Boolean(name))
    .map(cleanLabel);

export const isTechRemotarJob = (job: RemotarJob): boolean => {
  const titleAndTags = [job.title, getTags(job).join(" ")].filter(Boolean).join(" ");

  if (EXCLUDED_TITLE_PATTERNS.some((pattern) => pattern.test(job.title ?? ""))) {
    return false;
  }

  const hasSpecificTechCategory = (job.jobCategories ?? []).some((item) => {
    const id = item.category?.id;
    return typeof id === "number" && REMOTAR_TECH_CATEGORY_ID_SET.has(id) && id !== 13;
  });

  if (hasSpecificTechCategory) {
    return true;
  }

  return TECH_TITLE_PATTERNS.some((pattern) => pattern.test(titleAndTags));
};

export const normalizeRemotarJob = (job: RemotarJob): JobDTO => {
  const tags = getTags(job);
  const description = stripHtml(job.description ?? job.subtitle ?? "");
  const stack = extractStack([job.title, tags.join(" ")]);
  const publishedAt = parseDate(job.createdAt);
  const location = formatLocation(job.city, job.state, job.country?.name);

  return {
    source: "remotar",
    externalId: String(job.id),
    title: (job.title ?? "").trim(),
    company: (job.companyDisplayName ?? job.company?.name ?? "Empresa não informada").trim(),
    location,
    workMode: detectWorkMode(`${job.type ?? ""} ${tags.join(" ")}`),
    seniority: detectSeniority(`${job.title ?? ""} ${tags.join(" ")}`),
    url: job.externalLink ?? `https://remotar.com.br/jobs/${job.id}`,
    description: description || undefined,
    stack,
    publishedAt,
    scrapedAt: new Date(),
  };
};
