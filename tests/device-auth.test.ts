import { describe, expect, it } from "vitest";

import {
  buildDeviceRequestHeaders,
  DEVICE_KEY_HEADER,
  DEVICE_SESSION_STORAGE_KEY,
  parseDeviceKey,
  parseStoredDeviceSession,
  serializeStoredDeviceSession,
} from "../lib/device-auth";

describe("device auth helpers", () => {
  it("parses x-device-key into device id and secret", () => {
    expect(parseDeviceKey("device_123.secret_456")).toEqual({
      deviceId: "device_123",
      secret: "secret_456",
    });
  });

  it("rejects empty and malformed x-device-key values", () => {
    expect(parseDeviceKey("")).toBeNull();
    expect(parseDeviceKey("device-only")).toBeNull();
    expect(parseDeviceKey(".secret")).toBeNull();
    expect(parseDeviceKey("device.")).toBeNull();
    expect(parseDeviceKey("device.secret.extra")).toBeNull();
  });

  it("serializes and parses stored device session payloads safely", () => {
    const serialized = serializeStoredDeviceSession({
      deviceId: "device_123",
      label: "Front Desk Tablet",
      secret: "secret_456",
      claimedAt: 1_234_567_890,
    });

    expect(typeof serialized).toBe("string");
    expect(parseStoredDeviceSession(serialized)).toEqual({
      deviceId: "device_123",
      label: "Front Desk Tablet",
      secret: "secret_456",
      claimedAt: 1_234_567_890,
    });
  });

  it("returns null for invalid stored device session payloads", () => {
    expect(parseStoredDeviceSession("not-json")).toBeNull();
    expect(
      parseStoredDeviceSession(
        JSON.stringify({
          deviceId: "device_123",
          label: "Front Desk Tablet",
          secret: "secret_456",
        }),
      ),
    ).toBeNull();
  });

  it("exports stable header and local storage keys", () => {
    expect(DEVICE_KEY_HEADER).toBe("x-device-key");
    expect(DEVICE_SESSION_STORAGE_KEY).toBe("absensi.id.deviceSession");
  });

  it("builds explicit workspace-scoped headers for fresh device bootstrap", () => {
    expect(
      buildDeviceRequestHeaders({
        workspaceId: "workspace_123456",
        contentType: "application/json",
      }),
    ).toEqual({
      "content-type": "application/json",
      "x-workspace-id": "workspace_123456",
    });
  });
});
