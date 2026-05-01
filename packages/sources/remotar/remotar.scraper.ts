import pRetry, { AbortError } from "p-retry";
import { z } from "zod";
import { browserHeaders } from "../http.js";
import type { SourceJob } from "../types.js";
import { REMOTAR_TECH_CATEGORY_IDS, remotarJobSchema } from "./remotar.parser.js";
import type { RemotarJob } from "./remotar.parser.js";

const REMOTAR_API_BASE_URL = "https://api.remotar.com.br";

const remotarJobsResponseSchema = z.object({
  meta: z.object({
    total: z.number(),
    per_page: z.number(),
    current_page: z.number(),
    last_page: z.number(),
  }),
  data: z.array(remotarJobSchema),
});

export type RemotarScraperOptions = {
  maxPages?: number;
  active?: boolean;
  search?: string;
  tagIds?: number[];
  categoryIds?: number[] | null;
  since?: Date;
};

const buildJobsUrl = (page: number, options: RemotarScraperOptions): string => {
  const url = new URL("/jobs", REMOTAR_API_BASE_URL);

  url.searchParams.set("search", options.search ?? "");
  url.searchParams.set("page", String(page));

  if (options.active !== undefined) {
    url.searchParams.set("active", String(options.active));
  }

  if (options.tagIds?.length) {
    url.searchParams.set("tagId", options.tagIds.join(","));
  }

  const categoryIds =
    options.categoryIds === null
      ? []
      : options.categoryIds?.length
        ? options.categoryIds
        : [...REMOTAR_TECH_CATEGORY_IDS];

  if (categoryIds.length) {
    url.searchParams.set("categoryId", categoryIds.join(","));
  }

  return url.toString();
};

const fetchJson = async <T>(url: string, schema: z.ZodType<T>): Promise<T> => {
  return pRetry(
    async () => {
      const response = await fetch(url, {
        headers: browserHeaders({
          accept: "application/json, text/plain, */*",
          referer: "https://remotar.com.br/",
        }),
      });

      if (!response.ok) {
        throw new Error(`Remotar request failed: ${response.status} ${response.statusText} ${url}`);
      }

      const json = await response.json();
      const result = schema.safeParse(json);

      if (!result.success) {
        throw new AbortError(`Validation failed for Remotar API: ${result.error.message}`);
      }

      return result.data;
    },
    {
      retries: 3,
      onFailedAttempt: (error: any) => {
        console.warn(
          `[Remotar] Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left. Error: ${error.message}`,
        );
      },
    },
  );
};

export const fetchRemotarJobs = async (options: RemotarScraperOptions = {}): Promise<SourceJob<RemotarJob>[]> => {
  const maxPages = Math.max(1, options.maxPages ?? 1);
  const jobs: SourceJob<RemotarJob>[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    try {
      const payload = await fetchJson(buildJobsUrl(page, options), remotarJobsResponseSchema);
      let reachedOldJobs = false;

      for (const job of payload.data) {
        if (options.since && job.createdAt) {
          const jobDate = new Date(job.createdAt);
          if (jobDate < options.since) {
            reachedOldJobs = true;
            continue;
          }
        }

        jobs.push({
          source: "remotar",
          externalId: String(job.id),
          raw: job,
        });
      }

      if (reachedOldJobs || page >= payload.meta.last_page) {
        break;
      }
    } catch (error) {
      console.error(
        `[Remotar] Failed to fetch page ${page} after retries:`,
        error instanceof Error ? error.message : error,
      );
      break;
    }
  }

  return jobs;
};
