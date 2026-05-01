export type NotificationWindowConfig = {
  enabled: boolean;
  startHour: number;
  endHour: number;
  timeZone: string;
};

export type WorkerSource = "meupadrinho" | "remotar" | "gupy";

const WORKER_SOURCES: WorkerSource[] = ["meupadrinho", "remotar", "gupy"];

const clampHour = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), 0), 24);
};

const readBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

export function readNotificationWindowConfig(env: NodeJS.ProcessEnv = process.env): NotificationWindowConfig {
  return {
    enabled: readBool(env.NOTIFICATION_QUIET_HOURS_ENABLED, true),
    startHour: clampHour(Number(env.NOTIFICATION_START_HOUR ?? 6), 6),
    endHour: clampHour(Number(env.NOTIFICATION_END_HOUR ?? 24), 24),
    timeZone: env.NOTIFICATION_TIME_ZONE || "America/Sao_Paulo",
  };
}

export function readWorkerSources(env: { JOB_SOURCES?: string } = process.env): WorkerSource[] {
  const requestedSources = (env.JOB_SOURCES || WORKER_SOURCES.join(","))
    .split(",")
    .map((source) => source.trim().toLowerCase())
    .filter(Boolean);

  const supportedSources = new Set(WORKER_SOURCES);
  const sources = requestedSources.filter((source): source is WorkerSource =>
    supportedSources.has(source as WorkerSource)
  );

  return sources.length > 0 ? sources : [...WORKER_SOURCES];
}

export function selectSourceForCycle(sources: readonly WorkerSource[], date = new Date(), intervalMs = 10 * 60 * 1000): WorkerSource {
  if (sources.length === 0) {
    throw new Error("No worker sources configured");
  }

  const safeIntervalMs = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 10 * 60 * 1000;
  const dayStartMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const intervalBucket = Math.floor((date.getTime() - dayStartMs) / safeIntervalMs);

  return sources[intervalBucket % sources.length];
}

function getHourInTimeZone(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(date).find((part) => part.type === "hour")?.value;

  const parsed = Number(hour);
  return parsed === 24 ? 0 : parsed;
}

export function isWithinNotificationWindow(date: Date, config = readNotificationWindowConfig()): boolean {
  if (!config.enabled) return true;
  if (config.startHour === config.endHour) return true;

  const hour = getHourInTimeZone(date, config.timeZone);
  if (config.startHour < config.endHour) {
    return hour >= config.startHour && hour < config.endHour;
  }

  return hour >= config.startHour || hour < config.endHour;
}
