import { describe, expect, it } from "vitest";

import {
  buildLegacyAttendanceSourcePatch,
  assertScanSourceDeviceAllowed,
  buildScanMeta,
  normalizeLegacyScanMeta,
  normalizeLegacySourceDeviceId,
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

  it("normalizes legacy user ids out of sourceDeviceId fields", () => {
    const normalizeId = (tableName: string, id: string) =>
      tableName === "devices" && id === "device_123" ? id : null;

    expect(normalizeLegacySourceDeviceId(normalizeId, "device_123")).toBe(
      "device_123",
    );
    expect(normalizeLegacySourceDeviceId(normalizeId, "user_123")).toBeUndefined();
    expect(
      normalizeLegacyScanMeta(normalizeId, {
        ipAddress: "203.0.113.1",
        scannedAt: 1_234,
        sourceDeviceId: "user_123",
      }),
    ).toEqual({
      ipAddress: "203.0.113.1",
      scannedAt: 1_234,
    });
  });

  it("builds a patch only when attendance rows still contain legacy user ids", () => {
    const normalizeId = (tableName: string, id: string) => {
      if (tableName !== "devices") {
        return null;
      }
      return id === "device_123" ? id : null;
    };

    expect(
      buildLegacyAttendanceSourcePatch(normalizeId, {
        sourceDeviceId: "user_123",
        checkInMeta: {
          scannedAt: 10,
          sourceDeviceId: "user_123",
        },
        checkOutMeta: {
          scannedAt: 20,
          sourceDeviceId: "device_123",
        },
      }),
    ).toEqual({
      sourceDeviceId: undefined,
      checkInMeta: {
        scannedAt: 10,
      },
    });

    expect(
      buildLegacyAttendanceSourcePatch(normalizeId, {
        sourceDeviceId: "device_123",
        checkInMeta: {
          scannedAt: 10,
          sourceDeviceId: "device_123",
        },
        checkOutMeta: undefined,
      }),
    ).toBeNull();
  });
});
