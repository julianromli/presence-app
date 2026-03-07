import { describe, expect, it } from "vitest";

import {
  assertScanSourceDeviceAllowed,
  buildScanMeta,
} from "../convex/attendance";
import { DEVICE_HEARTBEAT_MAX_AGE_MS } from "../convex/deviceHeartbeatPolicy";

describe("attendance device source", () => {
  it("consumes QR token sources linked to deviceId", () => {
    expect(
      assertScanSourceDeviceAllowed(
        { _id: "device_123", status: "active" },
        { enforceDeviceHeartbeat: false, heartbeat: null },
        10_000,
      ),
    ).toBe("device_123");
  });

  it("writes sourceDeviceId into attendance metadata from registered devices", () => {
    expect(
      buildScanMeta(
        {
          ipAddress: "203.0.113.1",
          latitude: -6.2,
          longitude: 106.8,
          accuracyMeters: 15,
        },
        1_234_567_890,
        "device_123",
      ),
    ).toEqual({
      ipAddress: "203.0.113.1",
      latitude: -6.2,
      longitude: 106.8,
      accuracyMeters: 15,
      scannedAt: 1_234_567_890,
      sourceDeviceId: "device_123",
    });
  });

  it("rejects stale or revoked devices when heartbeat enforcement is enabled", () => {
    expect(() =>
      assertScanSourceDeviceAllowed(
        { _id: "device_123", status: "revoked" },
        { enforceDeviceHeartbeat: true, heartbeat: { lastSeenAt: 10_000 } },
        10_000,
      ),
    ).toThrow(/tidak valid/i);

    expect(() =>
      assertScanSourceDeviceAllowed(
        { _id: "device_123", status: "active" },
        {
          enforceDeviceHeartbeat: true,
          heartbeat: {
            lastSeenAt: 10_000 - DEVICE_HEARTBEAT_MAX_AGE_MS - 1,
          },
        },
        10_000,
      ),
    ).toThrow(/heartbeat/i);
  });
});
