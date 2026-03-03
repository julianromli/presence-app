import { describe, expect, it } from "vitest";

import {
  isAdminManagedActivationAllowed,
  isSelfDeactivation,
} from "../convex/usersPolicy";

describe("users policy", () => {
  it("allows admin activation changes only for karyawan and device-qr", () => {
    expect(isAdminManagedActivationAllowed("admin", "karyawan")).toBe(true);
    expect(isAdminManagedActivationAllowed("admin", "device-qr")).toBe(true);
    expect(isAdminManagedActivationAllowed("admin", "admin")).toBe(false);
    expect(isAdminManagedActivationAllowed("admin", "superadmin")).toBe(false);
  });

  it("allows superadmin activation changes for all roles", () => {
    expect(isAdminManagedActivationAllowed("superadmin", "karyawan")).toBe(true);
    expect(isAdminManagedActivationAllowed("superadmin", "admin")).toBe(true);
    expect(isAdminManagedActivationAllowed("superadmin", "superadmin")).toBe(true);
  });

  it("detects self deactivation", () => {
    expect(isSelfDeactivation("u1", "u1", false)).toBe(true);
    expect(isSelfDeactivation("u1", "u2", false)).toBe(false);
    expect(isSelfDeactivation("u1", "u1", true)).toBe(false);
  });
});
