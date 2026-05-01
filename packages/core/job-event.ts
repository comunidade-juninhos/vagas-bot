import { z } from "zod";
import type { JobDTO } from "./types.js";

export const JOB_CREATED_EVENT = "jobs.created" as const;

const dateLike = z.union([z.string(), z.date()]).transform((value, context) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid date"
    });
    return z.NEVER;
  }

  return date;
});

const jobSchema = z.object({
  source: z.enum(["linkedin", "indeed", "gupy", "remotar", "meupadrinho", "greenhouse", "lever", "company-site", "unknown"]),
  externalId: z.string().optional(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  workMode: z.enum(["remote", "hybrid", "onsite", "unknown"]),
  seniority: z.enum(["intern", "junior", "mid", "senior", "specialist", "lead", "unknown"]),
  url: z.string().url(),
  summary: z.string().optional(),
  description: z.string().optional(),
  stack: z.array(z.string()).default([]),
  salaryText: z.string().nullable().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  language: z.enum(["pt", "en", "es", "fr", "de", "it", "unknown"]).optional(),
  country: z.string().optional(),
  isInternational: z.boolean().optional(),
  publishedAt: dateLike.optional(),
  scrapedAt: dateLike
});

const jobCreatedEventSchema = z.object({
  event: z.literal(JOB_CREATED_EVENT),
  data: z.object({
    job: jobSchema
  })
});

export type JobCreatedEvent = {
  event: typeof JOB_CREATED_EVENT;
  data: {
    job: JobDTO;
  };
};

export function createJobCreatedEvent(job: JobDTO): JobCreatedEvent {
  return {
    event: JOB_CREATED_EVENT,
    data: {
      job
    }
  };
}

export function parseJobCreatedEvent(payload: unknown): JobCreatedEvent {
  return jobCreatedEventSchema.parse(payload) as JobCreatedEvent;
}
