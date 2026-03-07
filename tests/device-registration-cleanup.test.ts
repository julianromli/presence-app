import { describe, expect, it } from "vitest";

import {
  deriveRegistrationCodeStatus,
  pickExpiredRegistrationCodeIds,
} from "../convex/devices";
import { assertScanSourceDeviceAllowed } from "../convex/attendance";

describe("device registration cleanup", () => {
  it("selects only expired pending registration codes for cleanup", () => {
    expect(
      pickExpiredRegistrationCodeIds(
        [
          {
            _id: "code_expired",
            expiresAt: 9_000,
            claimedAt: undefined,
            revokedAt: undefined,
          },
          {
            _id: "code_claimed",
            expiresAt: 9_000,
            claimedAt: 8_500,
            revokedAt: undefined,
          },
          {
            _id: "code_revoked",
            expiresAt: 9_000,
            claimedAt: undefined,
            revokedAt: 8_000,
          },
        ],
        10_000,
      ),
    ).toEqual(["code_expired"]);
  });

  it("keeps derived status logic for expired codes", () => {
    expect(
      deriveRegistrationCodeStatus(
        {
          expiresAt: 9_999,
          claimedAt: undefined,
          revokedAt: undefined,
        },
        10_000,
      ),
    ).toBe("expired");
  });

  it("keeps revoked devices blocked after cleanup-related changes", () => {
    expect(() =>
      assertScanSourceDeviceAllowed(
        { _id: "device_123", status: "revoked" },
        { enforceDeviceHeartbeat: false, heartbeat: null },
        10_000,
      ),
    ).toThrow(/tidak valid/i);
  });
});
