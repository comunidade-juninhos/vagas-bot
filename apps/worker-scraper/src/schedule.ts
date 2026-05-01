export type NotificationWindowConfig = {
  enabled: boolean;
  startHour: number;
  endHour: number;
  timeZone: string;
};

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
