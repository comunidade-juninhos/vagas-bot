import type { JobDTO } from "./types.js";

const normalizeKeyPart = (value: string | null | undefined): string =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const contentKey = (job: JobDTO): string =>
  [
    normalizeKeyPart(job.title),
    normalizeKeyPart(job.company),
    normalizeKeyPart(job.location)
  ].join("|");

const gupyJobIdFromUrl = (url: URL): string | null => {
  if (!url.hostname.endsWith("gupy.io")) return null;

  const [, kind, encoded] = url.pathname.split("/");
  if (kind !== "job" || !encoded) return null;

  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as { jobId?: unknown };
    return typeof parsed.jobId === "number" || typeof parsed.jobId === "string"
      ? `gupy:${url.hostname}:${parsed.jobId}`
      : null;
  } catch {
    return null;
  }
};

const normalizedUrlKey = (value: string): string | null => {
  try {
    const url = new URL(value);
    const gupyKey = gupyJobIdFromUrl(url);
    if (gupyKey) return gupyKey;

    url.hash = "";
    url.search = "";
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
};

export const dedupeJobs = (jobs: JobDTO[]): JobDTO[] => {
  const seenSourceIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenContent = new Set<string>();
  const unique: JobDTO[] = [];

  for (const job of jobs) {
    const sourceKey = job.externalId ? `${job.source}:${job.externalId}` : null;
    const urlKey = normalizedUrlKey(job.url);
    const normalizedContentKey = contentKey(job);

    if (
      (sourceKey && seenSourceIds.has(sourceKey)) ||
      (urlKey && seenUrls.has(urlKey)) ||
      seenContent.has(normalizedContentKey)
    ) {
      continue;
    }

    if (sourceKey) seenSourceIds.add(sourceKey);
    if (urlKey) seenUrls.add(urlKey);
    seenContent.add(normalizedContentKey);
    unique.push(job);
  }

  return unique;
};
