export const DEFAULT_TIMEZONE = "Asia/Jakarta";

const timeZoneValidationCache = new Map();
let supportedTimeZonesCache = null;

function normalizeTimeZoneCandidate(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidTimeZone(value) {
  const candidate = normalizeTimeZoneCandidate(value);
  if (candidate.length === 0) {
    return false;
  }

  const cached = timeZoneValidationCache.get(candidate);
  if (cached !== undefined) {
    return cached;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    timeZoneValidationCache.set(candidate, true);
    return true;
  } catch {
    timeZoneValidationCache.set(candidate, false);
    return false;
  }
}

export function normalizeTimeZone(value, fallback = DEFAULT_TIMEZONE) {
  const candidate = normalizeTimeZoneCandidate(value);
  if (isValidTimeZone(candidate)) {
    return candidate;
  }

  return fallback;
}

export function getSupportedTimeZones() {
  if (supportedTimeZonesCache !== null) {
    return supportedTimeZonesCache;
  }

  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];
  const uniqueZones = new Set(zones.filter((zone) => isValidTimeZone(zone)));

  if (isValidTimeZone("UTC")) {
    uniqueZones.add("UTC");
  }

  if (isValidTimeZone(DEFAULT_TIMEZONE)) {
    uniqueZones.add(DEFAULT_TIMEZONE);
  }

  supportedTimeZonesCache = Array.from(uniqueZones).sort((left, right) =>
    left.localeCompare(right),
  );
  return supportedTimeZonesCache;
}

export function getTimeZoneOptions(selectedValue) {
  const selected = normalizeTimeZoneCandidate(selectedValue);
  const options = new Set(getSupportedTimeZones());

  if (selected.length > 0 && isValidTimeZone(selected)) {
    options.add(selected);
  }

  return Array.from(options).sort((left, right) => left.localeCompare(right));
}
