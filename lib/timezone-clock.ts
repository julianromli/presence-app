function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function resolveTimeZone(timeZone?: string) {
  if (!timeZone || !isValidTimeZone(timeZone)) {
    return "Asia/Jakarta";
  }
  return timeZone;
}

function getParts(timestamp: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(timestamp));
  const getPart = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second"),
  };
}

export function isValidClockValue(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

export function formatClockInTimeZone(
  timestamp: number | undefined,
  timeZone?: string,
) {
  if (timestamp === undefined) {
    return "";
  }

  const { hour, minute } = getParts(timestamp, resolveTimeZone(timeZone));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function resolveDateKeyClockToTimestamp(
  dateKey: string,
  clock: string | undefined,
  timeZone?: string,
) {
  if (!clock) {
    return undefined;
  }

  if (!isValidClockValue(clock)) {
    return undefined;
  }

  const [yearText, monthText, dayText] = dateKey.split("-");
  const [hourText, minuteText] = clock.split(":");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return undefined;
  }

  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = desired;
  const safeTimeZone = resolveTimeZone(timeZone);

  for (let iteration = 0; iteration < 5; iteration += 1) {
    const actual = getParts(guess, safeTimeZone);
    const actualUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      0,
    );
    const diffMs = desired - actualUtc;
    if (diffMs === 0) {
      return guess;
    }
    guess += diffMs;
  }

  return guess;
}
