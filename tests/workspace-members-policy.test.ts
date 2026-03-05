import { describe, expect, it } from "vitest";

import { isLastActiveSuperadminTransition } from "../convex/workspaceMembersPolicy";

describe("workspace members policy", () => {
  it("blocks when last active superadmin is demoted", () => {
    expect(
      isLastActiveSuperadminTransition({
        currentRole: "superadmin",
        currentActive: true,
        nextRole: "admin",
        nextActive: true,
        activeSuperadminCount: 1,
      }),
    ).toBe(true);
  });

  it("blocks when last active superadmin is deactivated", () => {
    expect(
      isLastActiveSuperadminTransition({
        currentRole: "superadmin",
        currentActive: true,
        nextRole: "superadmin",
        nextActive: false,
        activeSuperadminCount: 1,
      }),
    ).toBe(true);
  });

  it("allows transition when another active superadmin exists", () => {
    expect(
      isLastActiveSuperadminTransition({
        currentRole: "superadmin",
        currentActive: true,
        nextRole: "admin",
        nextActive: true,
        activeSuperadminCount: 2,
      }),
    ).toBe(false);
  });

  it("does not block non-superadmin transitions", () => {
    expect(
      isLastActiveSuperadminTransition({
        currentRole: "admin",
        currentActive: true,
        nextRole: "karyawan",
        nextActive: true,
        activeSuperadminCount: 1,
      }),
    ).toBe(false);
  });
});
