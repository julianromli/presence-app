import { describe, expect, it } from "vitest";

import {
  formatWorkspaceBillingPeriod,
  getRestrictedWorkspaceOverlayCopy,
  buildDeviceLimitNoticeCopy,
  formatWorkspaceMemberUsageCopy,
  getGeofencePremiumBannerCopy,
  getWorkspacePlanBadgeText,
  isAttendanceScheduleSaveDisabled,
  isReportExportDisabled,
} from "../lib/workspace-subscription-client";
import type { WorkspaceSubscriptionSummary } from "../types/dashboard";

function buildSubscription(
  overrides: Partial<WorkspaceSubscriptionSummary> = {},
): WorkspaceSubscriptionSummary {
  return {
    plan: "free",
    limits: {
      maxOwnedWorkspaces: 1,
      maxMembersPerWorkspace: 5,
      maxDevicesPerWorkspace: 1,
    },
    features: {
      geofence: false,
      ipWhitelist: false,
      attendanceSchedule: true,
      reportExport: false,
      inviteRotation: true,
      inviteExpiry: false,
    },
    usage: {
      activeMembers: 3,
      activeDevices: 1,
    },
    ...overrides,
  };
}

describe("workspace plan UI helpers", () => {
  it("maps workspace plans to badge text", () => {
    expect(getWorkspacePlanBadgeText("free")).toBe("Free");
    expect(getWorkspacePlanBadgeText("pro")).toBe("Pro");
    expect(getWorkspacePlanBadgeText("enterprise")).toBe("Enterprise");
  });

  it("formats member usage copy", () => {
    expect(formatWorkspaceMemberUsageCopy(3, 5)).toBe("3 / 5 member aktif");
  });

  it("returns a device limit notice when active devices hit the plan limit", () => {
    expect(buildDeviceLimitNoticeCopy(1, 1)).toBe(
      "Plan workspace ini sudah mencapai batas device aktif",
    );
    expect(buildDeviceLimitNoticeCopy(0, 1)).toBeNull();
    expect(buildDeviceLimitNoticeCopy(4, null)).toBeNull();
  });

  it("marks report export as disabled when the feature is unavailable", () => {
    expect(isReportExportDisabled(buildSubscription())).toBe(true);
    expect(
      isReportExportDisabled(
        buildSubscription({
          plan: "pro",
          features: {
            geofence: true,
            ipWhitelist: true,
            attendanceSchedule: true,
            reportExport: true,
            inviteRotation: true,
            inviteExpiry: true,
          },
        }),
      ),
    ).toBe(false);
  });

  it("returns a premium banner copy when geofence is unavailable", () => {
    expect(getGeofencePremiumBannerCopy(buildSubscription())).toBe(
      "Fitur geofence dan whitelist IP tersedia di paket Pro.",
    );
    expect(
      getGeofencePremiumBannerCopy(
        buildSubscription({
          plan: "pro",
          features: {
            geofence: true,
            ipWhitelist: true,
            attendanceSchedule: true,
            reportExport: true,
            inviteRotation: true,
            inviteExpiry: true,
          },
        }),
      ),
    ).toBeNull();
  });

  it("marks attendance schedule save as disabled when unavailable", () => {
    expect(
      isAttendanceScheduleSaveDisabled(
        buildSubscription({
          features: {
            geofence: false,
            ipWhitelist: false,
            attendanceSchedule: false,
            reportExport: false,
            inviteRotation: true,
            inviteExpiry: false,
          },
        }),
      ),
    ).toBe(true);
    expect(
      isAttendanceScheduleSaveDisabled(
        buildSubscription({
          plan: "pro",
          features: {
            geofence: true,
            ipWhitelist: true,
            attendanceSchedule: true,
            reportExport: true,
            inviteRotation: true,
            inviteExpiry: true,
          },
        }),
      ),
    ).toBe(false);
  });

  it("formats billing periods and pending restriction copy for the overlay", () => {
    expect(formatWorkspaceBillingPeriod(1_900_000_000_000, 1_902_592_000_000)).toBe(
      "18 Mar 2030 - 17 Apr 2030",
    );
    expect(formatWorkspaceBillingPeriod(1_900_000_000_000, 1_900_000_000_000)).toBe(
      "18 Mar 2030 - 18 Mar 2030",
    );
    expect(
      getRestrictedWorkspaceOverlayCopy({
        activeDevices: 2,
        activeMembers: 8,
        canManageRecovery: true,
        overFreeDeviceLimit: true,
        overFreeMemberLimit: true,
      }),
    ).toEqual({
      actionLabel: "Kurangi member/device atau aktifkan Pro lagi.",
      deviceTargetLabel: "Target device: 1 aktif atau kurang",
      memberTargetLabel: "Target member: 5 aktif atau kurang",
      title: "Akses dashboard dibatasi sementara",
    });
  });
});
