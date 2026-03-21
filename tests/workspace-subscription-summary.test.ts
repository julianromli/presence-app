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
  const membershipPaginate = vi.fn(async ({ cursor, numItems }: { cursor: string | null; numItems: number }) => {
    const offset = cursor ? Number.parseInt(cursor.replace("offset:", ""), 10) : 0;
    const page = memberships.slice(offset, offset + numItems);
    const nextOffset = offset + page.length;
    const isDone = nextOffset >= memberships.length;

    return {
      page,
      continueCursor: isDone ? "" : `offset:${nextOffset}`,
      isDone,
    };
  });
  const deviceCollect = vi.fn(async () => devices);

  const query = vi.fn((table: string) => ({
    withIndex: vi.fn((indexName: string) => {
      if (table === "workspace_members" && indexName === "by_workspace_active") {
        return {
          collect: membershipCollect,
          paginate: membershipPaginate,
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
      membershipPaginate,
      query,
    },
  };
}

describe("workspace subscription summary", () => {
  it("counts active members via pagination without materializing every membership", async () => {
    const ctx = buildCtx({
      memberships: Array.from({ length: 130 }, (_, index) => ({
        _id: `membership_${index + 1}`,
        workspaceId: "workspace_free",
        isActive: true,
      })),
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
        activeMembers: 130,
        activeDevices: 1,
      },
    });
    expect(ctx.mocks.membershipPaginate).toHaveBeenCalledTimes(2);
    expect(ctx.mocks.membershipCollect).not.toHaveBeenCalled();
    expect(ctx.mocks.deviceCollect).toHaveBeenCalledTimes(1);
  });
});
