export type JobSource =
  | "linkedin"
  | "indeed"
  | "gupy"
  | "remotar"
  | "meupadrinho"
  | "greenhouse"
  | "lever"
  | "company-site"
  | "unknown";

export type Seniority = "intern" | "junior" | "mid" | "senior" | "specialist" | "lead" | "unknown";

export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown";

export type JobLanguage = "pt" | "en" | "es" | "fr" | "de" | "it" | "unknown";

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
  summary?: string;
  description?: string;
  stack: string[];
  salaryText?: string | null;
  salaryMin?: number;
  salaryMax?: number;
  language?: JobLanguage;
  country?: string;
  isInternational?: boolean;
  publishedAt?: Date;
  scrapedAt: Date;
};

export type NormalizedJob = JobDTO;
