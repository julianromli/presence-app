import { describe, expect, it } from "vitest";

import type { AppRole } from "@/lib/auth";

type WorkspaceRoleGuardRoles = Parameters<
  typeof import("@/lib/auth").requireWorkspaceRolePageFromDb
>[0];

type RoleGuardRoles = Parameters<
  typeof import("@/lib/auth").requireRolePageFromDb
>[0];

const APP_ROLES = [
  "superadmin",
  "admin",
  "karyawan",
  "device-qr",
] as const satisfies readonly AppRole[];

const workspaceGuardRoles: WorkspaceRoleGuardRoles = APP_ROLES;
const roleGuardRoles: RoleGuardRoles = APP_ROLES;

describe("auth role guard typings", () => {
  it("accepts readonly app role lists", () => {
    expect(workspaceGuardRoles).toEqual(APP_ROLES);
    expect(roleGuardRoles).toEqual(APP_ROLES);
  });
});
