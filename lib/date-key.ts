function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function getDateKeyAtOffset(date: Date, timezoneOffsetMinutes: number) {
  const adjusted = new Date(date.getTime() - timezoneOffsetMinutes * 60_000);
  return `${adjusted.getUTCFullYear()}-${pad2(adjusted.getUTCMonth() + 1)}-${pad2(adjusted.getUTCDate())}`;
}

export function getLocalDateKey(date: Date = new Date()) {
  return getDateKeyAtOffset(date, date.getTimezoneOffset());
}
