const DEFAULT_CUTOFF_MINUTES = 8 * 60;
const DEFAULT_TIME_ZONE = "UTC";
const validTimeZoneCache = new Map();

function resolveTimeZone(timezone) {
  if (typeof timezone !== "string" || timezone.trim().length === 0) {
    return DEFAULT_TIME_ZONE;
  }

  const candidate = timezone.trim();
  const cached = validTimeZoneCache.get(candidate);
  if (cached) {
    return cached;
  }

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: candidate });
    validTimeZoneCache.set(candidate, candidate);
    return candidate;
  } catch {
    validTimeZoneCache.set(candidate, DEFAULT_TIME_ZONE);
    return DEFAULT_TIME_ZONE;
  }
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

export function computeDailyPoints(row, timezone, cutoffMinutes = DEFAULT_CUTOFF_MINUTES) {
  if (row.checkInAt === undefined) {
    return 0;
  }

  const onTime = isOnTimeCheckIn(row.checkInAt, timezone, cutoffMinutes);
  let points = onTime ? 10 : -3;
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
