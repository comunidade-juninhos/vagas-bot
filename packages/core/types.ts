export type JobSource = "linkedin" | "indeed" | "gupy" | "remotar" | "meupadrinho";

export type Seniority = "intern" | "junior" | "mid" | "senior" | "unknown";

export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown";

export type RawJob = {
  source: JobSource;
  raw: unknown;
};

export type JobDTO = {
  source: JobSource;
  externalId?: string;
  title: string;
  company: string;
  location?: string;
  workMode: WorkMode;
  seniority: Seniority;
  url: string;
  description?: string;
  stack: string[];
  publishedAt?: Date;
  scrapedAt: Date;
};

export type NormalizedJob = JobDTO;
