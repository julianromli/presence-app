import { describe, expect, it } from "vitest";

import {
  buildLegacyScanEventPatch,
  shouldDeleteLegacyDeviceHeartbeat,
  shouldDeleteLegacyQrToken,
} from "../convex/legacyDeviceMigration";

describe("legacy device migration helpers", () => {
  it("deletes heartbeat rows that still depend on legacy deviceUserId", () => {
    expect(
      shouldDeleteLegacyDeviceHeartbeat({
        deviceId: undefined,
        deviceUserId: "user_123",
      }),
    ).toBe(true);
    expect(
      shouldDeleteLegacyDeviceHeartbeat({
        deviceId: "device_123",
        deviceUserId: undefined,
      }),
    ).toBe(false);
  });

  it("deletes QR tokens that were issued for legacy device users", () => {
    expect(
      shouldDeleteLegacyQrToken({
        deviceId: undefined,
        deviceUserId: "user_123",
      }),
    ).toBe(true);
    expect(
      shouldDeleteLegacyQrToken({
        deviceId: "device_123",
        deviceUserId: undefined,
      }),
    ).toBe(false);
  });

  it("removes legacy deviceUserId from scan events and keeps valid device ids", () => {
    const normalizeId = (tableName: string, id: string) =>
      tableName === "devices" && id === "device_123" ? id : null;

    expect(
      buildLegacyScanEventPatch(normalizeId, {
        deviceId: "device_123",
        deviceUserId: "user_123",
      }),
    ).toEqual({
      deviceUserId: undefined,
    });

    expect(
      buildLegacyScanEventPatch(normalizeId, {
        deviceId: "user_123",
        deviceUserId: undefined,
      }),
    ).toEqual({
      deviceId: undefined,
    });
  });
});
