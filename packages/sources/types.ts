import type { JobSource } from "../core/types.js";

export type SourceJob<T = unknown> = {
  source: JobSource;
  externalId?: string;
  raw: T;
};
