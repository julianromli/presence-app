import { beforeEach, describe, expect, it, vi } from "vitest";

const requireWorkspaceRole = vi.fn();

vi.mock("../convex/helpers.js", () => ({
  requireIdentityUser: vi.fn(),
  requireWorkspaceRole,
}));

describe("workspaces delete mutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks deletion while another active member still exists", async () => {
    requireWorkspaceRole.mockResolvedValue({
      user: { _id: "user_actor" },
      membership: { _id: "membership_actor" },
    });

    const patch = vi.fn();
    const insert = vi.fn();
    const queryCollect = vi
      .fn()
      .mockResolvedValueOnce([
        { _id: "membership_actor", userId: "user_actor", isActive: true },
        { _id: "membership_other", userId: "user_other", isActive: true },
      ]);
    const ctx = {
      db: {
        get: vi.fn(async () => ({
          _id: "workspace_123456",
          slug: "absensi-id-hq",
          name: "Absensi.id HQ",
          isActive: true,
        })),
        patch,
        insert,
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({
            collect: queryCollect,
          })),
        })),
      },
    };

    const { deleteWorkspace } = await import("../convex/workspaces.js");

    await expect(
      deleteWorkspace._handler(ctx as never, { workspaceId: "workspace_123456" as never }),
    ).rejects.toMatchObject({
      data: {
        code: "WORKSPACE_DELETE_BLOCKED",
      },
    });

    expect(patch).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("deactivates workspace, active invite codes, and actor membership on success", async () => {
    requireWorkspaceRole.mockResolvedValue({
      user: { _id: "user_actor" },
      membership: { _id: "membership_actor" },
    });

    const patch = vi.fn(async () => undefined);
    const insert = vi.fn(async () => "audit_1");
    const collectMemberships = vi.fn(async () => [
      { _id: "membership_actor", userId: "user_actor", isActive: true },
    ]);
    const collectInviteCodes = vi.fn(async () => [
      { _id: "invite_active", isActive: true },
      { _id: "invite_inactive", isActive: false },
    ]);

    const ctx = {
      db: {
        get: vi.fn(async () => ({
          _id: "workspace_123456",
          slug: "absensi-id-hq",
          name: "Absensi.id HQ",
          isActive: true,
        })),
        patch,
        insert,
        query: vi.fn((table: string) => ({
          withIndex: vi.fn(() => ({
            collect:
              table === "workspace_members"
                ? collectMemberships
                : table === "workspace_invite_codes"
                  ? collectInviteCodes
                  : vi.fn(async () => []),
          })),
        })),
      },
    };

    const { deleteWorkspace } = await import("../convex/workspaces.js");
    const result = await deleteWorkspace._handler(ctx as never, {
      workspaceId: "workspace_123456" as never,
    });

    expect(result.workspaceId).toBe("workspace_123456");
    expect(typeof result.deletedAt).toBe("number");
    expect(patch).toHaveBeenCalledWith("workspace_123456", {
      isActive: false,
      updatedAt: result.deletedAt,
    });
    expect(patch).toHaveBeenCalledWith("invite_active", {
      isActive: false,
      updatedAt: result.deletedAt,
    });
    expect(patch).toHaveBeenCalledWith("membership_actor", {
      isActive: false,
      updatedAt: result.deletedAt,
    });
    expect(insert).toHaveBeenCalledWith(
      "audit_logs",
      expect.objectContaining({
        action: "workspace.deleted",
        workspaceId: "workspace_123456",
        actorUserId: "user_actor",
      }),
    );
  });
});
