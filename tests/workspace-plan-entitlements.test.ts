import { describe, expect, it } from "vitest";

import {
  PLAN_CATALOG,
  assertPlanLimitNotReached,
  assertWorkspaceFeatureEnabled,
  compareWorkspacePlans,
  isPlanLimitReached,
  resolveWorkspaceEntitlements,
  resolveWorkspacePlan,
} from "../convex/plans";

describe("workspace plan entitlements", () => {
  it("exposes free limits and feature flags", () => {
    expect(PLAN_CATALOG.free).toEqual({
      limits: {
        maxOwnedWorkspaces: 1,
        maxMembersPerWorkspace: 5,
        maxDevicesPerWorkspace: 1,
      },
      features: {
        geofence: false,
        ipWhitelist: false,
        attendanceSchedule: false,
        reportExport: false,
        inviteRotation: true,
        inviteExpiry: false,
      },
    });
  });

  it("exposes pro limits and feature flags", () => {
    expect(resolveWorkspaceEntitlements("pro")).toEqual({
      limits: {
        maxOwnedWorkspaces: 5,
        maxMembersPerWorkspace: 50,
        maxDevicesPerWorkspace: 3,
      },
      features: {
        geofence: true,
        ipWhitelist: true,
        attendanceSchedule: true,
        reportExport: true,
        inviteRotation: true,
        inviteExpiry: true,
      },
    });
  });

  it("treats enterprise null limits as unlimited", () => {
    expect(resolveWorkspaceEntitlements("enterprise")).toEqual({
      limits: {
        maxOwnedWorkspaces: null,
        maxMembersPerWorkspace: null,
        maxDevicesPerWorkspace: null,
      },
      features: {
        geofence: true,
        ipWhitelist: true,
        attendanceSchedule: true,
        reportExport: true,
        inviteRotation: true,
        inviteExpiry: true,
      },
    });
    expect(isPlanLimitReached(null, 999)).toBe(false);
  });

  it("falls back to free when workspace plan is missing", () => {
    expect(resolveWorkspacePlan({})).toBe("free");
    expect(resolveWorkspacePlan({ plan: undefined })).toBe("free");
  });

  it("supports ranking plans for create-time entitlement resolution", () => {
    const ownedWorkspacePlans = [{ plan: "free" }, { plan: "enterprise" }, { plan: "pro" }];
    const highestPlan = ownedWorkspacePlans
      .map((workspace) => resolveWorkspacePlan(workspace))
      .sort((left, right) => compareWorkspacePlans(right, left))[0];

    expect(compareWorkspacePlans("enterprise", "pro")).toBeGreaterThan(0);
    expect(compareWorkspacePlans("pro", "free")).toBeGreaterThan(0);
    expect(highestPlan).toBe("enterprise");
  });

  it("rejects invalid stored plan values", () => {
    expect(() => resolveWorkspacePlan({ plan: "starter" })).toThrow(/WORKSPACE_PLAN_INVALID/);
  });

  it("fails fast for invalid limit keys", () => {
    expect(() =>
      assertPlanLimitNotReached({
        plan: "free",
        limitKey: "maxUsersPerWorkspace",
        currentCount: 999,
      }),
    ).toThrow(/WORKSPACE_PLAN_LIMIT_KEY_INVALID/);
  });

  it("fails fast for invalid feature keys", () => {
    expect(() =>
      assertWorkspaceFeatureEnabled({
        plan: "pro",
        featureKey: "customBranding",
      }),
    ).toThrow(/WORKSPACE_PLAN_FEATURE_KEY_INVALID/);
  });

  it("keeps limit and feature keys aligned across every plan", () => {
    const [basePlan, ...otherPlans] = Object.keys(PLAN_CATALOG);
    const baseLimitKeys = Object.keys(PLAN_CATALOG[basePlan].limits).sort();
    const baseFeatureKeys = Object.keys(PLAN_CATALOG[basePlan].features).sort();

    for (const planName of otherPlans) {
      expect(Object.keys(PLAN_CATALOG[planName].limits).sort()).toEqual(baseLimitKeys);
      expect(Object.keys(PLAN_CATALOG[planName].features).sort()).toEqual(baseFeatureKeys);
    }
  });
});
