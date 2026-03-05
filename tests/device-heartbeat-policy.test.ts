import { describe, expect, it } from "vitest";

import {
  DEVICE_HEARTBEAT_MAX_AGE_MS,
  isDeviceHeartbeatFresh,
} from "../convex/deviceHeartbeatPolicy";

describe("device heartbeat policy", () => {
  it("returns false when heartbeat is missing", () => {
    expect(isDeviceHeartbeatFresh(undefined, 2_000)).toBe(false);
  });

  it("returns true when heartbeat age is within max threshold", () => {
    expect(
      isDeviceHeartbeatFresh(
        { lastSeenAt: 10_000 - DEVICE_HEARTBEAT_MAX_AGE_MS + 1 },
        10_000,
      ),
    ).toBe(true);
  });

  it("returns false when heartbeat is stale", () => {
    expect(
      isDeviceHeartbeatFresh(
        { lastSeenAt: 10_000 - DEVICE_HEARTBEAT_MAX_AGE_MS - 1 },
        10_000,
      ),
    ).toBe(false);
  });
});
