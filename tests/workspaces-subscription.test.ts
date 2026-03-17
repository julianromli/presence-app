import { beforeEach, describe, expect, it, vi } from "vitest";

const requireIdentityUser = vi.fn();
const requireWorkspaceRole = vi.fn();
const defaultAttendanceSchedule = vi.fn(() => ({
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
}));

vi.mock("../convex/helpers.js", () => ({
  defaultAttendanceSchedule,
  requireIdentityUser,
  requireWorkspaceRole,
}));

type OwnedWorkspaceRow = {
  _id: string;
  slug: string;
  name: string;
  isActive: boolean;
  plan?: "free" | "pro" | "enterprise";
  createdByUserId: string;
};

function makeCreateWorkspaceCtx(ownedWorkspaces: OwnedWorkspaceRow[] = []) {
  const insert = vi.fn(async (table: string) => {
    if (table === "workspaces") {
      return "workspace_created";
    }

    return `${table}_created`;
  });

  const workspacesBySlugUnique = vi.fn(async () => null);
  const workspacesByOwnerCollect = vi.fn(async () => ownedWorkspaces);
  const inviteCodeUnique = vi.fn(async () => null);

  const query = vi.fn((table: string) => ({
    withIndex: vi.fn((indexName: string) => {
      if (table === "workspaces" && indexName === "by_slug") {
        return {
          unique: workspacesBySlugUnique,
        };
      }

      if (table === "workspaces" && indexName === "by_created_by_user") {
        return {
          collect: workspacesByOwnerCollect,
        };
      }

      if (table === "workspace_invite_codes" && indexName === "by_code") {
        return {
          unique: inviteCodeUnique,
        };
      }

      throw new Error(`Unexpected query: ${table}.${indexName}`);
    }),
  }));

  return {
    ctx: {
      db: {
        insert,
        query,
      },
    },
    mocks: {
      insert,
      query,
      inviteCodeUnique,
      workspacesByOwnerCollect,
      workspacesBySlugUnique,
    },
  };
}

describe("workspace subscription create limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    requireIdentityUser.mockResolvedValue({ _id: "user_actor" });
  });

  it("evaluates the first owned workspace as free", async () => {
    const { createWorkspace } = await import("../convex/workspaces.js");
    const { ctx, mocks } = makeCreateWorkspaceCtx();

    const result = await createWorkspace._handler(ctx as never, {
      name: "Presence Ops",
    });

    expect(result.workspaceId).toBe("workspace_created");
    expect(mocks.insert).toHaveBeenCalledWith(
      "workspaces",
      expect.objectContaining({
        createdByUserId: "user_actor",
        isActive: true,
        name: "Presence Ops",
        plan: "free",
      }),
    );
    expect(mocks.inviteCodeUnique).toHaveBeenCalledTimes(1);
  });

  it("prevents a free owner from creating a second active owned workspace", async () => {
    const { createWorkspace } = await import("../convex/workspaces.js");
    const { ctx, mocks } = makeCreateWorkspaceCtx([
      {
        _id: "workspace_free_1",
        slug: "presence-hq",
        name: "Presence HQ",
        plan: "free",
        isActive: true,
        createdByUserId: "user_actor",
      },
    ]);

    await expect(
      createWorkspace._handler(ctx as never, { name: "Second Workspace" }),
    ).rejects.toMatchObject({
      data: {
        code: "PLAN_LIMIT_REACHED",
        message: expect.stringMatching(/workspace/i),
      },
    });

    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("allows more workspace creation after an owned workspace is upgraded to pro", async () => {
    const { createWorkspace } = await import("../convex/workspaces.js");
    const { ctx, mocks } = makeCreateWorkspaceCtx([
      {
        _id: "workspace_pro_1",
        slug: "presence-hq",
        name: "Presence HQ",
        plan: "pro",
        isActive: true,
        createdByUserId: "user_actor",
      },
      {
        _id: "workspace_free_2",
        slug: "presence-ops",
        name: "Presence Ops",
        plan: "free",
        isActive: true,
        createdByUserId: "user_actor",
      },
    ]);

    const result = await createWorkspace._handler(ctx as never, {
      name: "Third Workspace",
    });

    expect(result.workspaceId).toBe("workspace_created");
    expect(mocks.workspacesByOwnerCollect).toHaveBeenCalledTimes(1);
  });

  it("treats enterprise as unlimited because the catalog limit is null", async () => {
    const { createWorkspace } = await import("../convex/workspaces.js");
    const { ctx, mocks } = makeCreateWorkspaceCtx(
      Array.from({ length: 8 }, (_, index) => ({
        _id: `workspace_enterprise_${index + 1}`,
        slug: `enterprise-${index + 1}`,
        name: `Enterprise ${index + 1}`,
        plan: "enterprise" as const,
        isActive: true,
        createdByUserId: "user_actor",
      })),
    );

    const result = await createWorkspace._handler(ctx as never, {
      name: "Enterprise Expansion",
    });

    expect(result.workspaceId).toBe("workspace_created");
    expect(mocks.insert).toHaveBeenCalledWith(
      "workspaces",
      expect.objectContaining({
        name: "Enterprise Expansion",
      }),
    );
  });
});
