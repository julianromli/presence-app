import { describe, expect, it } from "vitest";

import {
  assertRegistrationCodeClaimable,
  deriveRegistrationCodeStatus,
  hashDeviceCredential,
} from "../convex/devices";

describe("device registration code helpers", () => {
  it("hashes code and device secrets deterministically", async () => {
    await expect(hashDeviceCredential("CODE-123")).resolves.toBe(
      await hashDeviceCredential("CODE-123"),
    );
    await expect(hashDeviceCredential("secret-abc")).resolves.not.toBe(
      await hashDeviceCredential("secret-def"),
    );
  });

  it("derives pending and claimed status correctly", () => {
    expect(
      deriveRegistrationCodeStatus(
        {
          expiresAt: 20_000,
          claimedAt: undefined,
          revokedAt: undefined,
        },
        10_000,
      ),
    ).toBe("pending");

    expect(
      deriveRegistrationCodeStatus(
        {
          expiresAt: 20_000,
          claimedAt: 15_000,
          revokedAt: undefined,
        },
        10_000,
      ),
    ).toBe("claimed");
  });

  it("derives expired and revoked status correctly", () => {
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

    expect(
      deriveRegistrationCodeStatus(
        {
          expiresAt: 20_000,
          claimedAt: undefined,
          revokedAt: 9_000,
        },
        10_000,
      ),
    ).toBe("revoked");
  });

  it("rejects claim for expired, claimed, and revoked codes", () => {
    expect(() =>
      assertRegistrationCodeClaimable(
        {
          expiresAt: 9_000,
          claimedAt: undefined,
          revokedAt: undefined,
        },
        10_000,
      ),
    ).toThrow(/kedaluwarsa/i);

    expect(() =>
      assertRegistrationCodeClaimable(
        {
          expiresAt: 20_000,
          claimedAt: 15_000,
          revokedAt: undefined,
        },
        10_000,
      ),
    ).toThrow(/sudah dipakai/i);

    expect(() =>
      assertRegistrationCodeClaimable(
        {
          expiresAt: 20_000,
          claimedAt: undefined,
          revokedAt: 15_000,
        },
        10_000,
      ),
    ).toThrow(/sudah tidak aktif/i);
  });

  it("allows claim for pending codes", () => {
    expect(() =>
      assertRegistrationCodeClaimable(
        {
          expiresAt: 20_000,
          claimedAt: undefined,
          revokedAt: undefined,
        },
        10_000,
      ),
    ).not.toThrow();
  });
});
