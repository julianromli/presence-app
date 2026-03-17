import { describe, expect, it, vi } from "vitest";

import { getWorkspaceSubscriptionSummary } from "../convex/workspaceSubscription";

function buildCtx({
  memberships,
  devices,
}: {
  memberships: Array<{ _id: string; workspaceId: string; isActive: boolean }>;
  devices: Array<{ _id: string; workspaceId: string; status: "active" | "revoked" }>;
}) {
  const membershipCollect = vi.fn(async () => memberships);
  const deviceCollect = vi.fn(async () => devices);

  const query = vi.fn((table: string) => ({
    withIndex: vi.fn((indexName: string) => {
      if (table === "workspace_members" && indexName === "by_workspace_active") {
        return {
          collect: membershipCollect,
          take: vi.fn(),
        };
      }

      if (table === "devices" && indexName === "by_workspace_status") {
        return {
          collect: deviceCollect,
          take: vi.fn(),
        };
      }

      throw new Error(`Unexpected query: ${table}.${indexName}`);
    }),
  }));

  return {
    db: {
      query,
    },
    mocks: {
      deviceCollect,
      membershipCollect,
      query,
    },
  };
}

describe("workspace subscription summary", () => {
  it("counts active members and devices without paginating", async () => {
    const ctx = buildCtx({
      memberships: [
        { _id: "membership_1", workspaceId: "workspace_free", isActive: true },
        { _id: "membership_2", workspaceId: "workspace_free", isActive: true },
        { _id: "membership_3", workspaceId: "workspace_free", isActive: true },
      ],
      devices: [
        { _id: "device_1", workspaceId: "workspace_free", status: "active" },
      ],
    });

    const result = await getWorkspaceSubscriptionSummary(ctx as never, {
      _id: "workspace_free",
      plan: "free",
      isActive: true,
    });

    expect(result).toEqual({
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
    });
    expect(ctx.mocks.membershipCollect).toHaveBeenCalledTimes(1);
    expect(ctx.mocks.deviceCollect).toHaveBeenCalledTimes(1);
  });
});
