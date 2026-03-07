export const DEVICE_KEY_HEADER = "x-device-key";
export const DEVICE_SESSION_STORAGE_KEY = "absensi.id.deviceSession";
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

export type StoredDeviceSession = {
  deviceId: string;
  label: string;
  secret: string;
  claimedAt: number;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStoredDeviceSession(value: unknown): value is StoredDeviceSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    isNonEmptyString(candidate.deviceId) &&
    isNonEmptyString(candidate.label) &&
    isNonEmptyString(candidate.secret) &&
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

export function serializeStoredDeviceSession(value: StoredDeviceSession) {
  return JSON.stringify(value);
}

export function parseStoredDeviceSession(rawValue: string | null | undefined) {
  if (!isNonEmptyString(rawValue)) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    return isStoredDeviceSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
