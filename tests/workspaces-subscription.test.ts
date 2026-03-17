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

type JoinWorkspaceOptions = {
  activeMemberships?: Array<{ _id: string; isActive: boolean }>;
  existingMembership?: {
    _id: string;
    workspaceId: string;
    userId: string;
    role: "superadmin" | "admin" | "karyawan" | "device-qr";
    isActive: boolean;
  } | null;
  invite?: {
    _id: string;
    workspaceId: string;
    code: string;
    isActive: boolean;
    expiresAt?: number;
  } | null;
  workspace?: {
    _id: string;
    name: string;
    slug?: string;
    plan?: "free" | "pro" | "enterprise";
    isActive: boolean;
  } | null;
};

function makeJoinWorkspaceCtx(options: JoinWorkspaceOptions = {}) {
  const workspace =
    options.workspace ?? {
      _id: "workspace_free",
      name: "Presence HQ",
      slug: "presence-hq",
      plan: "free" as const,
      isActive: true,
    };
  const invite =
    options.invite ?? {
      _id: "invite_1",
      workspaceId: workspace._id,
      code: "TEAM-123-PRESENCE",
      isActive: true,
    };
  const existingMembership = options.existingMembership ?? null;
  const activeMemberships = options.activeMemberships ?? [];

  const insert = vi.fn(async () => "workspace_member_created");
  const patch = vi.fn(async () => undefined);
  const get = vi.fn(async (id: string) => (id === workspace?._id ? workspace : null));
  const inviteUnique = vi.fn(async () => invite);
  const membershipUnique = vi.fn(async () => existingMembership);
  const activeMembersCollect = vi.fn(async () => activeMemberships);

  const query = vi.fn((table: string) => ({
    withIndex: vi.fn((indexName: string) => {
      if (table === "workspace_invite_codes" && indexName === "by_code") {
        return { unique: inviteUnique };
      }

      if (table === "workspace_members" && indexName === "by_workspace_and_user") {
        return { unique: membershipUnique };
      }

      if (table === "workspace_members" && indexName === "by_workspace_active") {
        return { collect: activeMembersCollect };
      }

      throw new Error(`Unexpected query: ${table}.${indexName}`);
    }),
  }));

  return {
    ctx: {
      db: {
        get,
        insert,
        patch,
        query,
      },
    },
    mocks: {
      activeMembersCollect,
      get,
      insert,
      inviteUnique,
      membershipUnique,
      patch,
      query,
    },
  };
}

type UpdateAdminManagedFieldsOptions = {
  actorRole?: "superadmin" | "admin";
  targetMembership?: {
    _id: string;
    workspaceId: string;
    userId: string;
    role: "superadmin" | "admin" | "karyawan" | "device-qr";
    isActive: boolean;
  };
  targetUser?: {
    _id: string;
    _creationTime: number;
    clerkUserId: string;
    name: string;
    email: string;
    createdAt: number;
    updatedAt: number;
  };
  activeMemberships?: Array<{
    _id: string;
    workspaceId: string;
    userId: string;
    role: "superadmin" | "admin" | "karyawan" | "device-qr";
    isActive: boolean;
  }>;
  workspace?: {
    _id: string;
    name: string;
    slug?: string;
    plan?: "free" | "pro" | "enterprise";
    isActive: boolean;
  };
};

function makeUpdateAdminManagedFieldsCtx(options: UpdateAdminManagedFieldsOptions = {}) {
  const workspace =
    options.workspace ?? {
      _id: "workspace_free",
      name: "Presence HQ",
      slug: "presence-hq",
      plan: "free" as const,
      isActive: true,
    };
  const targetUser =
    options.targetUser ?? {
      _id: "user_target",
      _creationTime: 1,
      clerkUserId: "clerk_target",
      name: "Target User",
      email: "target@example.com",
      createdAt: 1,
      updatedAt: 1,
    };
  const targetMembership =
    options.targetMembership ?? {
      _id: "membership_target",
      workspaceId: workspace._id,
      userId: targetUser._id,
      role: "karyawan" as const,
      isActive: false,
    };
  const activeMemberships =
    options.activeMemberships ??
    Array.from({ length: 5 }, (_, index) => ({
      _id: `membership_active_${index + 1}`,
      workspaceId: workspace._id,
      userId: `user_active_${index + 1}`,
      role: index === 0 ? ("superadmin" as const) : ("karyawan" as const),
      isActive: true,
    }));

  const actorMembership = {
    _id: "membership_actor",
    workspaceId: workspace._id,
    userId: "user_actor",
    role: options.actorRole ?? "superadmin",
    isActive: true,
  };

  const patch = vi.fn(async () => undefined);
  const insert = vi.fn(async () => "audit_log_created");
  const get = vi.fn(async (id: string) => {
    if (id === targetUser._id) {
      return targetUser;
    }
    if (id === workspace._id) {
      return workspace;
    }
    return null;
  });
  const membershipUnique = vi.fn(async () => targetMembership);
  const activeMembersCollect = vi.fn(async () => activeMemberships);
  const activeSuperadminsCollect = vi.fn(async () =>
    activeMemberships.filter((membership) => membership.role === "superadmin" && membership.isActive),
  );

  const query = vi.fn((table: string) => ({
    withIndex: vi.fn((indexName: string) => {
      if (table === "workspace_members" && indexName === "by_workspace_and_user") {
        return { unique: membershipUnique };
      }

      if (table === "workspace_members" && indexName === "by_workspace_active") {
        return { collect: activeMembersCollect };
      }

      if (table === "workspace_members" && indexName === "by_workspace_role_active") {
        return { collect: activeSuperadminsCollect };
      }

      throw new Error(`Unexpected query: ${table}.${indexName}`);
    }),
  }));

  return {
    ctx: {
      db: {
        get,
        insert,
        patch,
        query,
      },
    },
    actorMembership,
    actorUser: { _id: "user_actor" },
    mocks: {
      activeMembersCollect,
      activeSuperadminsCollect,
      get,
      insert,
      membershipUnique,
      patch,
      query,
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

describe("workspace subscription member limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    requireIdentityUser.mockResolvedValue({ _id: "user_actor" });
    requireWorkspaceRole.mockResolvedValue({
      user: { _id: "user_actor" },
      membership: {
        _id: "membership_actor",
        workspaceId: "workspace_free",
        userId: "user_actor",
        role: "superadmin",
        isActive: true,
      },
    });
  });

  it("prevents joining a workspace when active members already reached the plan limit", async () => {
    const { joinWorkspaceByCode } = await import("../convex/workspaces.js");
    const { ctx, mocks } = makeJoinWorkspaceCtx({
      activeMemberships: Array.from({ length: 5 }, (_, index) => ({
        _id: `membership_${index + 1}`,
        isActive: true,
      })),
      existingMembership: null,
    });

    await expect(
      joinWorkspaceByCode._handler(ctx as never, { code: "TEAM-123-PRESENCE" }),
    ).rejects.toMatchObject({
      data: {
        code: "PLAN_LIMIT_REACHED",
        message: expect.stringMatching(/member/i),
      },
    });

    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("prevents reactivating an inactive membership from invite join when active members already reached the plan limit", async () => {
    const { joinWorkspaceByCode } = await import("../convex/workspaces.js");
    const { ctx, mocks } = makeJoinWorkspaceCtx({
      activeMemberships: Array.from({ length: 5 }, (_, index) => ({
        _id: `membership_${index + 1}`,
        isActive: true,
      })),
      existingMembership: {
        _id: "membership_target",
        workspaceId: "workspace_free",
        userId: "user_actor",
        role: "karyawan",
        isActive: false,
      },
    });

    await expect(
      joinWorkspaceByCode._handler(ctx as never, { code: "TEAM-123-PRESENCE" }),
    ).rejects.toMatchObject({
      data: {
        code: "PLAN_LIMIT_REACHED",
        message: expect.stringMatching(/member/i),
      },
    });

    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("prevents admin member reactivation when active members already reached the plan limit", async () => {
    const { updateAdminManagedFields } = await import("../convex/users.js");
    const { actorMembership, actorUser, ctx, mocks } = makeUpdateAdminManagedFieldsCtx();
    requireWorkspaceRole.mockResolvedValue({
      user: actorUser,
      membership: actorMembership,
    });

    await expect(
      updateAdminManagedFields._handler(ctx as never, {
        workspaceId: "workspace_free",
        userId: "user_target",
        isActive: true,
      }),
    ).rejects.toMatchObject({
      data: {
        code: "PLAN_LIMIT_REACHED",
        message: expect.stringMatching(/member/i),
      },
    });

    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
