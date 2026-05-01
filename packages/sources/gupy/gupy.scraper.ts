import pRetry, { AbortError } from "p-retry";
import { z } from "zod";
import { browserHeaders } from "../http.js";
import type { SourceJob } from "../types.js";
import { gupyJobSchema } from "./gupy.parser.js";
import type { GupyJob } from "./gupy.parser.js";

const GUPY_API_URL = "https://employability-portal.gupy.io/api/v1/jobs";
const DEFAULT_LIMIT = 100;

const gupyJobsResponseSchema = z.object({
  data: z.array(gupyJobSchema),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number()
  })
});

export type GupyScraperOptions = {
  keywords?: string[];
  maxPagesPerKeyword?: number;
  limit?: number;
  workplaceTypes?: string[];
  country?: string;
  state?: string;
  jobTypes?: string[];
  since?: Date;
};

const buildGupyUrl = (keyword: string, offset: number, options: GupyScraperOptions): string => {
  const url = new URL(GUPY_API_URL);
  url.searchParams.set("jobName", keyword);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(Math.min(options.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT)));

  if (options.workplaceTypes?.length) {
    url.searchParams.set("workplaceTypes", options.workplaceTypes.join(","));
  }

  if (options.country) {
    url.searchParams.set("country", options.country);
  }

  if (options.state) {
    url.searchParams.set("state", options.state);
  }

  if (options.jobTypes?.length) {
    url.searchParams.set("jobTypes", options.jobTypes.join(","));
  }

  return url.toString();
};

const fetchJson = async <T>(url: string, schema: z.ZodType<T>): Promise<T> => {
  return pRetry(
    async () => {
      const response = await fetch(url, {
        headers: browserHeaders({
          accept: "application/json, text/plain, */*",
          origin: "https://portal.gupy.io",
          referer: "https://portal.gupy.io/",
        }),
      });

      if (!response.ok) {
        throw new Error(`Gupy request failed: ${response.status} ${response.statusText} ${url}`);
      }

      const json = await response.json();
      const result = schema.safeParse(json);

      if (!result.success) {
        throw new AbortError(`Validation failed for Gupy API: ${result.error.message}`);
      }

      return result.data;
    },
    {
      retries: 3,
      onFailedAttempt: (error: any) => {
        console.warn(`[Gupy] Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left. Error: ${error.message}`);
      }
    }
  );
};

export const fetchGupyJobs = async (options: GupyScraperOptions = {}): Promise<SourceJob<GupyJob>[]> => {
  const keywords = options.keywords?.length ? options.keywords : ["desenvolvedor", "qa", "devops", "dados"];
  const maxPagesPerKeyword = Math.max(1, options.maxPagesPerKeyword ?? 1);
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT);
  const jobs: SourceJob<GupyJob>[] = [];

  for (const keyword of keywords) {
    for (let page = 0; page < maxPagesPerKeyword; page += 1) {
      try {
        const offset = page * limit;
        const payload = await fetchJson(buildGupyUrl(keyword, offset, { ...options, limit }), gupyJobsResponseSchema);

        for (const job of payload.data) {
          if (options.since && job.publishedDate) {
            const jobDate = new Date(job.publishedDate);
            if (jobDate < options.since) {
              continue;
            }
          }

          jobs.push({
            source: "gupy",
            externalId: String(job.id),
            raw: job
          });
        }

        if (offset + payload.pagination.limit >= payload.pagination.total) {
          break;
        }
      } catch (error) {
        console.error(`[Gupy] Failed to fetch page ${page} for keyword "${keyword}" after retries:`, error instanceof Error ? error.message : error);
        break;
      }
    }
  }

  return jobs;
};
