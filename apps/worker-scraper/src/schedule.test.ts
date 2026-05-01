import { describe, expect, it } from "vitest";
import { isWithinNotificationWindow, readNotificationWindowConfig } from "./schedule.js";

describe("worker notification schedule", () => {
  it("allows notifications from 06:00 until before midnight in Sao Paulo", () => {
    const config = readNotificationWindowConfig({
      NOTIFICATION_START_HOUR: "6",
      NOTIFICATION_END_HOUR: "24",
      NOTIFICATION_TIME_ZONE: "America/Sao_Paulo",
    });

    expect(isWithinNotificationWindow(new Date("2026-05-01T08:59:00.000Z"), config)).toBe(false);
    expect(isWithinNotificationWindow(new Date("2026-05-01T09:00:00.000Z"), config)).toBe(true);
    expect(isWithinNotificationWindow(new Date("2026-05-02T02:59:00.000Z"), config)).toBe(true);
    expect(isWithinNotificationWindow(new Date("2026-05-02T03:00:00.000Z"), config)).toBe(false);
  });

  it("can be disabled for manual validation runs", () => {
    const config = readNotificationWindowConfig({
      NOTIFICATION_QUIET_HOURS_ENABLED: "false",
    });

    expect(isWithinNotificationWindow(new Date("2026-05-01T04:00:00.000Z"), config)).toBe(true);
  });
});
