import { beforeEach, describe, expect, it, vi } from "vitest";

const requireIdentityUser = vi.fn();
const requireWorkspaceRole = vi.fn();
const defaultAttendanceSchedule = vi.fn(() => [
  { day: "monday", enabled: true, checkInTime: "08:00" },
  { day: "tuesday", enabled: true, checkInTime: "08:00" },
  { day: "wednesday", enabled: true, checkInTime: "08:00" },
  { day: "thursday", enabled: true, checkInTime: "08:00" },
  { day: "friday", enabled: true, checkInTime: "08:00" },
  { day: "saturday", enabled: false },
  { day: "sunday", enabled: false },
]);

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
  createdByUserId?: string;
};

type LegacyOwnershipMembershipRow = {
  _id: string;
  workspaceId: string;
  userId: string;
  role: "superadmin" | "admin" | "karyawan" | "device-qr";
  isActive: boolean;
};

function makeCreateWorkspaceCtx(
  ownedWorkspaces: OwnedWorkspaceRow[] = [],
  options: {
    legacyOwnerMemberships?: LegacyOwnershipMembershipRow[];
    legacyWorkspaces?: OwnedWorkspaceRow[];
  } = {},
) {
  const insert = vi.fn(async (table: string) => {
    if (table === "workspaces") {
      return "workspace_created";
    }

    return `${table}_created`;
  });

  const legacyOwnerMemberships = options.legacyOwnerMemberships ?? [];
  const allWorkspaces = [...ownedWorkspaces, ...(options.legacyWorkspaces ?? [])];
  const workspacesBySlugUnique = vi.fn(async () => null);
  const workspacesByOwnerCollect = vi.fn(async () => ownedWorkspaces);
  const membershipsByUserCollect = vi.fn(async () => legacyOwnerMemberships);
  const inviteCodeUnique = vi.fn(async () => null);
  const get = vi.fn(async (id: string) => allWorkspaces.find((workspace) => workspace._id === id) ?? null);

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

      if (table === "workspace_members" && indexName === "by_user_and_workspace") {
        return {
          collect: membershipsByUserCollect,
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
        get,
        insert,
        query,
      },
    },
    mocks: {
      get,
      insert,
      query,
      inviteCodeUnique,
      membershipsByUserCollect,
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
  const activeMembersTake = vi.fn(async (limit: number) => activeMemberships.slice(0, limit));

  const query = vi.fn((table: string) => ({
    withIndex: vi.fn((indexName: string) => {
      if (table === "workspace_invite_codes" && indexName === "by_code") {
        return { unique: inviteUnique };
      }

      if (table === "workspace_members" && indexName === "by_workspace_and_user") {
        return { unique: membershipUnique };
      }

      if (table === "workspace_members" && indexName === "by_workspace_active") {
        return { collect: activeMembersCollect, take: activeMembersTake };
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
      activeMembersTake,
      get,
      insert,
      inviteUnique,
      membershipUnique,
      patch,
      query,
    },
  };
}

type UpdateActiveInviteExpiryOptions = {
  inviteCodes?: Array<{
    _id: string;
    workspaceId: string;
    code: string;
    isActive: boolean;
    expiresAt?: number;
    updatedAt: number;
  }>;
  workspace?: {
    _id: string;
    name: string;
    slug?: string;
    plan?: "free" | "pro" | "enterprise";
    isActive: boolean;
  };
};

function makeUpdateActiveInviteExpiryCtx(options: UpdateActiveInviteExpiryOptions = {}) {
  const workspace =
    options.workspace ?? {
      _id: "workspace_free",
      name: "Presence HQ",
      slug: "presence-hq",
      plan: "free" as const,
      isActive: true,
    };
  const inviteCodes =
    options.inviteCodes ?? [
      {
        _id: "invite_active",
        workspaceId: workspace._id,
        code: "TEAM-123-PRESENCE",
        isActive: true,
        updatedAt: 2000,
      },
    ];

  const get = vi.fn(async (id: string) => (id === workspace._id ? workspace : null));
  const patch = vi.fn(async () => undefined);
  const collectInviteCodes = vi.fn(async () => inviteCodes);
  const query = vi.fn((table: string) => ({
    withIndex: vi.fn((indexName: string) => {
      if (table === "workspace_invite_codes" && indexName === "by_workspace") {
        return { collect: collectInviteCodes };
      }

      throw new Error(`Unexpected query: ${table}.${indexName}`);
    }),
  }));

  return {
    ctx: {
      db: {
        get,
        patch,
        query,
      },
    },
    mocks: {
      collectInviteCodes,
      get,
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
  const activeMembersTake = vi.fn(async (limit: number) => activeMemberships.slice(0, limit));
  const activeSuperadminsCollect = vi.fn(async () =>
    activeMemberships.filter((membership) => membership.role === "superadmin" && membership.isActive),
  );

  const query = vi.fn((table: string) => ({
    withIndex: vi.fn((indexName: string) => {
      if (table === "workspace_members" && indexName === "by_workspace_and_user") {
        return { unique: membershipUnique };
      }

      if (table === "workspace_members" && indexName === "by_workspace_active") {
        return { collect: activeMembersCollect, take: activeMembersTake };
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
      activeMembersTake,
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
    expect(mocks.insert).toHaveBeenCalledWith(
      "settings",
      expect.objectContaining({
        attendanceSchedule: defaultAttendanceSchedule(),
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

  it("counts legacy superadmin ownership when createdByUserId is missing", async () => {
    const { createWorkspace } = await import("../convex/workspaces.js");
    const { ctx, mocks } = makeCreateWorkspaceCtx([], {
      legacyOwnerMemberships: [
        {
          _id: "membership_legacy_owner",
          workspaceId: "workspace_legacy_free",
          userId: "user_actor",
          role: "superadmin",
          isActive: true,
        },
      ],
      legacyWorkspaces: [
        {
          _id: "workspace_legacy_free",
          slug: "legacy-hq",
          name: "Legacy HQ",
          plan: "free",
          isActive: true,
        },
      ],
    });

    await expect(
      createWorkspace._handler(ctx as never, { name: "Second Workspace" }),
    ).rejects.toMatchObject({
      data: {
        code: "PLAN_LIMIT_REACHED",
        message: expect.stringMatching(/workspace/i),
      },
    });

    expect(mocks.membershipsByUserCollect).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledWith("workspace_legacy_free");
    expect(mocks.insert).not.toHaveBeenCalled();
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

describe("workspace invite expiry entitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
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

  it("prevents free workspaces from setting an invite expiry", async () => {
    const { updateActiveInviteExpiry } = await import("../convex/workspaces.js");
    const { ctx, mocks } = makeUpdateActiveInviteExpiryCtx({
      workspace: {
        _id: "workspace_free",
        name: "Presence HQ",
        slug: "presence-hq",
        plan: "free",
        isActive: true,
      },
    });

    await expect(
      updateActiveInviteExpiry._handler(ctx as never, {
        workspaceId: "workspace_free" as never,
        expiryPreset: "30d",
      }),
    ).rejects.toMatchObject({
      data: {
        code: "FEATURE_NOT_AVAILABLE",
        message: "Invite expiry hanya tersedia untuk paket Pro atau Enterprise.",
      },
    });

    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("allows pro workspaces to set a new expiry timestamp on the active invite code", async () => {
    const { updateActiveInviteExpiry } = await import("../convex/workspaces.js");
    vi.spyOn(Date, "now").mockReturnValue(1_900_000_000_000);
    const { ctx, mocks } = makeUpdateActiveInviteExpiryCtx({
      workspace: {
        _id: "workspace_pro",
        name: "Presence Pro",
        slug: "presence-pro",
        plan: "pro",
        isActive: true,
      },
      inviteCodes: [
        {
          _id: "invite_active",
          workspaceId: "workspace_pro",
          code: "PRO-123-PRESENCE",
          isActive: true,
          updatedAt: 2000,
        },
      ],
    });

    const result = await updateActiveInviteExpiry._handler(ctx as never, {
      workspaceId: "workspace_pro" as never,
      expiryPreset: "30d",
    });

    expect(result).toEqual({
      inviteCodeId: "invite_active",
      expiresAt: 1_902_592_000_000,
      updatedAt: 1_900_000_000_000,
    });
    expect(mocks.patch).toHaveBeenCalledWith(
      "invite_active",
      {
        expiresAt: 1_902_592_000_000,
        updatedAt: 1_900_000_000_000,
      },
    );
  });

  it("allows superadmin to clear invite expiry back to undefined", async () => {
    const { updateActiveInviteExpiry } = await import("../convex/workspaces.js");
    vi.spyOn(Date, "now").mockReturnValue(1_900_000_000_000);
    const { ctx, mocks } = makeUpdateActiveInviteExpiryCtx({
      workspace: {
        _id: "workspace_pro",
        name: "Presence Pro",
        slug: "presence-pro",
        plan: "pro",
        isActive: true,
      },
      inviteCodes: [
        {
          _id: "invite_active",
          workspaceId: "workspace_pro",
          code: "PRO-123-PRESENCE",
          isActive: true,
          expiresAt: 1900000000000,
          updatedAt: 2000,
        },
      ],
    });

    const result = await updateActiveInviteExpiry._handler(ctx as never, {
      workspaceId: "workspace_pro" as never,
      expiryPreset: "never",
    });

    expect(result).toEqual({
      inviteCodeId: "invite_active",
      expiresAt: undefined,
      updatedAt: 1_900_000_000_000,
    });
    expect(mocks.patch).toHaveBeenCalledWith(
      "invite_active",
      {
        expiresAt: undefined,
        updatedAt: 1_900_000_000_000,
      },
    );
  });
});
