import { describe, expect, it } from "vitest";

import {
  buildDeviceRequestHeaders,
  createDeviceAuthCookieHeader,
  createExpiredDeviceAuthCookieHeader,
  DEVICE_AUTH_COOKIE,
  DEVICE_KEY_HEADER,
  parseDeviceAuthCookieFromHeader,
  parseDeviceKey,
  parseDeviceSession,
  serializeDeviceSession,
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

  it("serializes and parses device session payloads safely", () => {
    const serialized = serializeDeviceSession({
      deviceId: "device_123",
      label: "Front Desk Tablet",
      claimedAt: 1_234_567_890,
    });

    expect(typeof serialized).toBe("string");
    expect(parseDeviceSession(serialized)).toEqual({
      deviceId: "device_123",
      label: "Front Desk Tablet",
      claimedAt: 1_234_567_890,
    });
  });

  it("returns null for invalid device session payloads", () => {
    expect(parseDeviceSession("not-json")).toBeNull();
    expect(
      parseDeviceSession(
        JSON.stringify({
          deviceId: "device_123",
          label: "Front Desk Tablet",
        }),
      ),
    ).toBeNull();
  });

  it("reads device auth cookies and exports stable auth keys", () => {
    expect(DEVICE_KEY_HEADER).toBe("x-device-key");
    expect(DEVICE_AUTH_COOKIE).toBe("absenin.id.deviceAuth");
    expect(
      parseDeviceAuthCookieFromHeader(
        "theme=light; absenin.id.deviceAuth=device_123.secret_456; other=value",
      ),
    ).toEqual({
      deviceId: "device_123",
      secret: "secret_456",
    });
  });

  it("creates secure cookie headers for device auth lifecycle", () => {
    expect(createDeviceAuthCookieHeader("device_123.secret_456")).toContain(
      "absenin.id.deviceAuth=device_123.secret_456",
    );
    expect(createDeviceAuthCookieHeader("device_123.secret_456")).toContain("HttpOnly");
    expect(createExpiredDeviceAuthCookieHeader()).toContain("Max-Age=0");
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
