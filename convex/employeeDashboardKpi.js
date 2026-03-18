import { DEFAULT_TIMEZONE, normalizeTimeZone } from "../lib/timezones";

const DEFAULT_CUTOFF_MINUTES = 8 * 60;
const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function defaultAttendanceSchedule() {
  return [
    { day: "monday", enabled: true, checkInTime: "08:00" },
    { day: "tuesday", enabled: true, checkInTime: "08:00" },
    { day: "wednesday", enabled: true, checkInTime: "08:00" },
    { day: "thursday", enabled: true, checkInTime: "08:00" },
    { day: "friday", enabled: true, checkInTime: "08:00" },
    { day: "saturday", enabled: false },
    { day: "sunday", enabled: false },
  ];
}

export function parseClockToMinutes(clock) {
  if (typeof clock !== "string" || !/^\d{2}:\d{2}$/.test(clock)) {
    return null;
  }

  const [hourText, minuteText] = clock.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

export function getScheduleForDateKey(dateKey, schedule) {
  const day = WEEKDAY_KEYS[new Date(`${dateKey}T00:00:00.000Z`).getUTCDay()];
  return schedule.find((row) => row.day === day) ?? null;
}

export function resolveCheckInPunctuality({ dateKey, checkInAt, timezone, schedule }) {
  const row = getScheduleForDateKey(dateKey, schedule);
  if (!row?.enabled) {
    return "not-applicable";
  }

  const scheduledMinutes = parseClockToMinutes(row.checkInTime);
  if (scheduledMinutes === null || checkInAt === undefined) {
    return "not-applicable";
  }

  return getMinutesInTimezone(checkInAt, timezone) <= scheduledMinutes ? "on-time" : "late";
}

function resolveTimeZone(timezone) {
  return normalizeTimeZone(timezone, DEFAULT_TIMEZONE);
}

export function parseOffsetCursor(cursor) {
  if (!cursor || !cursor.startsWith("offset:")) {
    return 0;
  }

  const offset = Number.parseInt(cursor.slice("offset:".length), 10);
  if (Number.isNaN(offset) || offset < 0) {
    return 0;
  }
  return offset;
}

export function paginateRows(rows, paginationOpts) {
  const offset = parseOffsetCursor(paginationOpts.cursor);
  const limit = Math.max(1, paginationOpts.numItems ?? 20);
  const page = rows.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const isDone = nextOffset >= rows.length;

  return {
    page,
    isDone,
    continueCursor: isDone ? "" : `offset:${nextOffset}`,
  };
}

export function getCutoffMinutes() {
  return DEFAULT_CUTOFF_MINUTES;
}

export function getMinutesInTimezone(ts, timezone) {
  const safeTimeZone = resolveTimeZone(timezone);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTimeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(ts));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function formatMinutesToClock(minutes) {
  const safe = Math.min(Math.max(minutes, 0), 23 * 60 + 59);
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function isWorkday(dateKey) {
  const day = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

export function isOnTimeCheckIn(checkInAt, timezone, cutoffMinutes = DEFAULT_CUTOFF_MINUTES) {
  if (checkInAt === undefined) {
    return false;
  }
  return getMinutesInTimezone(checkInAt, timezone) <= cutoffMinutes;
}

function resolveLegacyPunctuality(checkInAt, timezone, cutoffMinutes = DEFAULT_CUTOFF_MINUTES) {
  return isOnTimeCheckIn(checkInAt, timezone, cutoffMinutes) ? "on-time" : "late";
}

/**
 * @param {{ dateKey: string, checkInAt?: number, checkOutAt?: number }} row
 * @param {string} timezone
 * @param {number | Array<{ day: string, enabled: boolean, checkInTime?: string }>} [scheduleOrCutoff=DEFAULT_CUTOFF_MINUTES]
 */
export function computeDailyPoints(row, timezone, scheduleOrCutoff = DEFAULT_CUTOFF_MINUTES) {
  if (row.checkInAt === undefined) {
    return 0;
  }

  const punctuality = Array.isArray(scheduleOrCutoff)
    ? resolveCheckInPunctuality({
        dateKey: row.dateKey,
        checkInAt: row.checkInAt,
        timezone,
        schedule: scheduleOrCutoff,
      })
    : resolveLegacyPunctuality(row.checkInAt, timezone, scheduleOrCutoff);
  let points = punctuality === "late" ? -3 : 10;
  if (row.checkOutAt !== undefined) {
    points += 4;
  }
  return points;
}

export function computeStreakBonus(onTimeSequence) {
  let streak = 0;
  let bonus = 0;
  for (const onTime of onTimeSequence) {
    if (onTime) {
      streak += 1;
      if (streak % 3 === 0) {
        bonus += 5;
      }
      continue;
    }
    streak = 0;
  }
  return bonus;
}

export function computeDisciplineScore(totalPoints, workdayCount) {
  if (workdayCount <= 0) {
    return 0;
  }

  const maxBasePoints = workdayCount * 14;
  const maxBonusPoints = Math.floor(workdayCount / 3) * 5;
  const maxPoints = maxBasePoints + maxBonusPoints;
  if (maxPoints <= 0) {
    return 0;
  }

  const normalized = Math.max(0, Math.min(100, (totalPoints / maxPoints) * 100));
  return Number(normalized.toFixed(1));
}
