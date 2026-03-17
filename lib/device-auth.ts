export const DEVICE_KEY_HEADER = "x-device-key";
export const DEVICE_AUTH_COOKIE = "absenin.id.deviceAuth";
export const WORKSPACE_ID_HEADER = "x-workspace-id";

export const DEVICE_STATUS = ["active", "revoked"] as const;
export const DEVICE_REGISTRATION_CODE_STATUS = [
  "pending",
  "claimed",
  "expired",
  "revoked",
] as const;

export type DeviceStatus = (typeof DEVICE_STATUS)[number];
export type DeviceRegistrationCodeStatus =
  (typeof DEVICE_REGISTRATION_CODE_STATUS)[number];

export type ParsedDeviceKey = {
  deviceId: string;
  secret: string;
};

export type DeviceSession = {
  deviceId: string;
  label: string;
  claimedAt: number;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDeviceSession(value: unknown): value is DeviceSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    isNonEmptyString(candidate.deviceId) &&
    isNonEmptyString(candidate.label) &&
    typeof candidate.claimedAt === "number" &&
    Number.isFinite(candidate.claimedAt)
  );
}

export function parseDeviceKey(rawValue: string | null | undefined): ParsedDeviceKey | null {
  if (!isNonEmptyString(rawValue)) {
    return null;
  }

  const trimmed = rawValue.trim();
  const separatorIndex = trimmed.indexOf(".");
  if (separatorIndex <= 0 || separatorIndex !== trimmed.lastIndexOf(".")) {
    return null;
  }

  const deviceId = trimmed.slice(0, separatorIndex).trim();
  const secret = trimmed.slice(separatorIndex + 1).trim();
  if (!deviceId || !secret) {
    return null;
  }

  return { deviceId, secret };
}

export function buildDeviceKey(value: ParsedDeviceKey) {
  return `${value.deviceId}.${value.secret}`;
}

function readCookieValue(rawCookieHeader: string | null | undefined, cookieName: string) {
  if (!rawCookieHeader) {
    return null;
  }

  const prefix = `${cookieName}=`;
  for (const part of rawCookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) {
      continue;
    }

    const rawValue = trimmed.slice(prefix.length);
    if (!rawValue) {
      return null;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }

  return null;
}

export function buildDeviceRequestHeaders({
  workspaceId,
  deviceKey,
  contentType,
}: {
  workspaceId?: string | null;
  deviceKey?: string | null;
  contentType?: string | null;
}) {
  const headers: Record<string, string> = {};

  if (contentType) {
    headers["content-type"] = contentType;
  }

  if (workspaceId) {
    headers[WORKSPACE_ID_HEADER] = workspaceId;
  }

  if (deviceKey) {
    headers[DEVICE_KEY_HEADER] = deviceKey;
  }

  return headers;
}

export function parseDeviceAuthCookie(rawValue: string | null | undefined) {
  return parseDeviceKey(rawValue);
}

export function parseDeviceAuthCookieFromHeader(rawCookieHeader: string | null | undefined) {
  return parseDeviceAuthCookie(readCookieValue(rawCookieHeader, DEVICE_AUTH_COOKIE));
}

export function serializeDeviceSession(value: DeviceSession) {
  return JSON.stringify(value);
}

export function parseDeviceSession(rawValue: string | null | undefined) {
  if (!isNonEmptyString(rawValue)) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    return isDeviceSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createDeviceAuthCookieHeader(deviceKey: string) {
  const parts = [
    `${DEVICE_AUTH_COOKIE}=${encodeURIComponent(deviceKey)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function createExpiredDeviceAuthCookieHeader() {
  const parts = [
    `${DEVICE_AUTH_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "Max-Age=0",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}
