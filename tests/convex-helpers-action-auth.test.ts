import { describe, expect, it, vi } from "vitest";

vi.mock("../convex/_generated/api", () => ({
  api: {
    users: { me: "users:me" },
    workspaces: { myMembershipByWorkspace: "workspaces:myMembershipByWorkspace" },
  },
}));

describe("convex action auth helpers", () => {
  it("loads the current user and workspace membership through action queries", async () => {
    const { requireWorkspaceRoleFromAction } = await import("../convex/helpers");
    const runQuery = vi.fn(async (reference: string, args?: Record<string, unknown>) => {
      if (reference === "users:me") {
        return {
          _id: "user_superadmin",
          _creationTime: 1_900_000_000_000,
          clerkUserId: "clerk_user_123",
          createdAt: 1_900_000_000_000,
          email: "owner@absenin.id",
          isActive: true,
          name: "Owner Workspace",
          role: "superadmin",
          updatedAt: 1_900_000_000_000,
        };
      }

      if (reference === "workspaces:myMembershipByWorkspace") {
        expect(args).toEqual({ workspaceId: "workspace_123456" });
        return {
          isActive: true,
          membershipId: "membership_superadmin",
          role: "superadmin",
          workspace: {
            _creationTime: 1_900_000_000_000,
            _id: "workspace_123456",
            createdAt: 1_900_000_000_000,
            isActive: true,
            name: "Workspace",
            slug: "workspace",
            updatedAt: 1_900_000_000_000,
          },
        };
      }

      throw new Error(`Unexpected runQuery call: ${reference}`);
    });

    const result = await requireWorkspaceRoleFromAction(
      { runQuery } as never,
      "workspace_123456" as never,
      ["superadmin"],
    );

    expect(runQuery).toHaveBeenNthCalledWith(1, "users:me", {});
    expect(runQuery).toHaveBeenNthCalledWith(2, "workspaces:myMembershipByWorkspace", {
      workspaceId: "workspace_123456",
    });
    expect(result).toEqual({
      membership: expect.objectContaining({
        isActive: true,
        membershipId: "membership_superadmin",
        role: "superadmin",
      }),
      user: expect.objectContaining({
        _id: "user_superadmin",
        email: "owner@absenin.id",
        name: "Owner Workspace",
      }),
    });
  });

  it("fails unauthenticated before loading workspace membership", async () => {
    const { requireWorkspaceRoleFromAction } = await import("../convex/helpers");
    const runQuery = vi.fn(async (reference: string) => {
      if (reference === "users:me") {
        return null;
      }

      throw new Error(`Unexpected runQuery call: ${reference}`);
    });

    await expect(
      requireWorkspaceRoleFromAction(
        { runQuery } as never,
        "workspace_123456" as never,
        ["superadmin"],
      ),
    ).rejects.toMatchObject({
      data: {
        code: "UNAUTHENTICATED",
        message: "Login required",
      },
    });

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runQuery).toHaveBeenCalledWith("users:me", {});
  });

  it("fails inactive users before loading workspace membership", async () => {
    const { requireWorkspaceRoleFromAction } = await import("../convex/helpers");
    const runQuery = vi.fn(async (reference: string) => {
      if (reference === "users:me") {
        return {
          _id: "user_superadmin",
          _creationTime: 1_900_000_000_000,
          clerkUserId: "clerk_user_123",
          createdAt: 1_900_000_000_000,
          email: "owner@absenin.id",
          isActive: false,
          name: "Owner Workspace",
          role: "superadmin",
          updatedAt: 1_900_000_000_000,
        };
      }

      throw new Error(`Unexpected runQuery call: ${reference}`);
    });

    await expect(
      requireWorkspaceRoleFromAction(
        { runQuery } as never,
        "workspace_123456" as never,
        ["superadmin"],
      ),
    ).rejects.toMatchObject({
      data: {
        code: "INACTIVE_USER",
        message: "User is inactive",
      },
    });

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runQuery).toHaveBeenCalledWith("users:me", {});
  });
});
