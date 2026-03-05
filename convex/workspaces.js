import { ConvexError, v } from "convex/values";

import { internalQuery, mutation, query } from "./_generated/server";
import { requireIdentityUser, requireWorkspaceRole } from "./helpers";
import { listActiveInviteCodeIds } from "./workspaceInvitePolicy";

const workspaceRoleValidator = v.union(
  v.literal("superadmin"),
  v.literal("admin"),
  v.literal("karyawan"),
  v.literal("device-qr"),
);

const workspaceValidator = v.object({
  _id: v.id("workspaces"),
  _creationTime: v.number(),
  slug: v.string(),
  name: v.string(),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  createdByUserId: v.optional(v.id("users")),
});

const membershipWithWorkspaceValidator = v.object({
  membershipId: v.id("workspace_members"),
  role: workspaceRoleValidator,
  isActive: v.boolean(),
  workspace: workspaceValidator,
});

const onboardingStateValidator = v.object({
  hasActiveMembership: v.boolean(),
  memberships: v.array(membershipWithWorkspaceValidator),
});

const workspaceManagementValidator = v.object({
  workspace: workspaceValidator,
  activeInviteCode: v.union(
    v.null(),
    v.object({
      _id: v.id("workspace_invite_codes"),
      code: v.string(),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastRotatedAt: v.optional(v.number()),
      expiresAt: v.optional(v.number()),
    }),
  ),
});

function normalizeWorkspaceName(value) {
  return value.trim().replace(/\s+/g, " ");
}

function slugifyWorkspaceName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeInviteCode(input) {
  return input.trim().toUpperCase().replace(/\s+/g, "").replace(/-+/g, "-");
}

function generateInviteCode(seed) {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${seed}-${random}-PRESENCE`.replace(/-+/g, "-").toUpperCase();
}

async function generateUniqueInviteCode(ctx, seed) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateInviteCode(seed);
    const existing = await ctx.db
      .query("workspace_invite_codes")
      .withIndex("by_code", (q) => q.eq("code", candidate))
      .unique();
    if (!existing) {
      return candidate;
    }
  }

  throw new ConvexError({
    code: "INTERNAL_ERROR",
    message: "Gagal menghasilkan invitation code unik.",
  });
}

async function ensureUniqueWorkspaceSlug(ctx, baseSlug) {
  const initial = baseSlug || "workspace";
  let candidate = initial;
  let counter = 2;

  while (true) {
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .unique();

    if (!existing) {
      return candidate;
    }

    candidate = `${initial}-${counter}`;
    counter += 1;
  }
}

async function listActiveMemberships(ctx, userId) {
  const memberships = await ctx.db
    .query("workspace_members")
    .withIndex("by_user_and_workspace", (q) => q.eq("userId", userId))
    .collect();

  const activeMemberships = memberships.filter((item) => item.isActive);
  const results = [];

  for (const membership of activeMemberships) {
    const workspace = await ctx.db.get(membership.workspaceId);
    if (!workspace || !workspace.isActive) {
      continue;
    }

    results.push({
      membershipId: membership._id,
      role: membership.role,
      isActive: membership.isActive,
      workspace,
    });
  }

  return results;
}

async function getActiveInviteCodeByWorkspace(ctx, workspaceId) {
  const inviteCodes = await ctx.db
    .query("workspace_invite_codes")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const active = inviteCodes
    .filter((item) => item.isActive)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
  return active ?? null;
}

export const myOnboardingState = query({
  args: {},
  returns: onboardingStateValidator,
  handler: async (ctx) => {
    const user = await requireIdentityUser(ctx);
    const memberships = await listActiveMemberships(ctx, user._id);

    return {
      hasActiveMembership: memberships.length > 0,
      memberships,
    };
  },
});

export const myMembershipByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: v.union(
    v.null(),
    v.object({
      membershipId: v.id("workspace_members"),
      role: workspaceRoleValidator,
      isActive: v.boolean(),
      workspace: workspaceValidator,
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireIdentityUser(ctx);
    const membership = await ctx.db
      .query("workspace_members")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id),
      )
      .unique();

    if (!membership || !membership.isActive) {
      return null;
    }

    const workspace = await ctx.db.get(membership.workspaceId);
    if (!workspace || !workspace.isActive) {
      return null;
    }

    return {
      membershipId: membership._id,
      role: membership.role,
      isActive: membership.isActive,
      workspace,
    };
  },
});

export const workspaceManagementDetail = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: workspaceManagementValidator,
  handler: async (ctx, args) => {
    await requireWorkspaceRole(ctx, args.workspaceId, ["superadmin"]);

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || !workspace.isActive) {
      throw new ConvexError({
        code: "WORKSPACE_INVALID",
        message: "Workspace tidak valid.",
      });
    }

    const activeInviteCode = await getActiveInviteCodeByWorkspace(ctx, args.workspaceId);
    return {
      workspace,
      activeInviteCode,
    };
  },
});

export const createWorkspace = mutation({
  args: {
    name: v.string(),
  },
  returns: v.object({
    workspaceId: v.id("workspaces"),
    inviteCode: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireIdentityUser(ctx);
    const name = normalizeWorkspaceName(args.name);

    if (name.length < 3) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Workspace name minimal 3 karakter.",
      });
    }

    const baseSlug = slugifyWorkspaceName(name);
    const slug = await ensureUniqueWorkspaceSlug(ctx, baseSlug);
    const now = Date.now();

    const workspaceId = await ctx.db.insert("workspaces", {
      slug,
      name,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdByUserId: user._id,
    });

    await ctx.db.insert("workspace_members", {
      workspaceId,
      userId: user._id,
      role: "superadmin",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const inviteCode = generateInviteCode(slug.toUpperCase());
    await ctx.db.insert("workspace_invite_codes", {
      workspaceId,
      code: inviteCode,
      isActive: true,
      expiresAt: undefined,
      createdByUserId: user._id,
      createdAt: now,
      updatedAt: now,
      lastRotatedAt: now,
    });

    await ctx.db.insert("settings", {
      key: "global",
      workspaceId,
      timezone: "Asia/Jakarta",
      geofenceEnabled: false,
      geofenceRadiusMeters: 100,
      scanCooldownSeconds: 30,
      minLocationAccuracyMeters: 100,
      enforceDeviceHeartbeat: false,
      geofenceLat: undefined,
      geofenceLng: undefined,
      whitelistEnabled: false,
      whitelistIps: [],
      updatedBy: user._id,
      updatedAt: now,
    });

    await ctx.db.insert("users_metrics", {
      key: "global",
      workspaceId,
      total: 0,
      active: 0,
      inactive: 0,
      byRole: {
        superadmin: { total: 0, active: 0 },
        admin: { total: 0, active: 0 },
        karyawan: { total: 0, active: 0 },
        "device-qr": { total: 0, active: 0 },
      },
      updatedAt: now,
    });

    return { workspaceId, inviteCode };
  },
});

export const joinWorkspaceByCode = mutation({
  args: {
    code: v.string(),
  },
  returns: v.object({
    workspaceId: v.id("workspaces"),
    workspaceName: v.string(),
    alreadyMember: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireIdentityUser(ctx);
    const code = normalizeInviteCode(args.code);

    if (!code) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Invitation code wajib diisi.",
      });
    }

    const invite = await ctx.db
      .query("workspace_invite_codes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();

    if (!invite) {
      throw new ConvexError({
        code: "CODE_NOT_FOUND",
        message: "Kode undangan tidak ditemukan.",
      });
    }

    if (!invite.isActive) {
      throw new ConvexError({
        code: "CODE_INACTIVE",
        message: "Kode undangan sudah tidak aktif.",
      });
    }

    if (invite.expiresAt !== undefined && invite.expiresAt <= Date.now()) {
      throw new ConvexError({
        code: "CODE_EXPIRED",
        message: "Kode undangan sudah kedaluwarsa.",
      });
    }

    const workspace = await ctx.db.get(invite.workspaceId);
    if (!workspace || !workspace.isActive) {
      throw new ConvexError({
        code: "WORKSPACE_INVALID",
        message: "Workspace tidak valid.",
      });
    }

    const existingMembership = await ctx.db
      .query("workspace_members")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", workspace._id).eq("userId", user._id),
      )
      .unique();

    const now = Date.now();
    if (existingMembership) {
      if (existingMembership.isActive) {
        return {
          workspaceId: workspace._id,
          workspaceName: workspace.name,
          alreadyMember: true,
        };
      }

      await ctx.db.patch(existingMembership._id, {
        role: "karyawan",
        isActive: true,
        updatedAt: now,
      });

      return {
        workspaceId: workspace._id,
        workspaceName: workspace.name,
        alreadyMember: false,
      };
    }

    await ctx.db.insert("workspace_members", {
      workspaceId: workspace._id,
      userId: user._id,
      role: "karyawan",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return {
      workspaceId: workspace._id,
      workspaceName: workspace.name,
      alreadyMember: false,
    };
  },
});

export const renameWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
  },
  returns: v.object({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    slug: v.string(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireWorkspaceRole(ctx, args.workspaceId, ["superadmin"]);

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || !workspace.isActive) {
      throw new ConvexError({
        code: "WORKSPACE_INVALID",
        message: "Workspace tidak valid.",
      });
    }

    const name = normalizeWorkspaceName(args.name);
    if (name.length < 3) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Workspace name minimal 3 karakter.",
      });
    }

    const now = Date.now();
    const baseSlug = slugifyWorkspaceName(name);
    const slug = baseSlug === workspace.slug ? workspace.slug : await ensureUniqueWorkspaceSlug(ctx, baseSlug);
    await ctx.db.patch(workspace._id, {
      name,
      slug,
      updatedAt: now,
    });

    return {
      workspaceId: workspace._id,
      name,
      slug,
      updatedAt: now,
    };
  },
});

export const rotateWorkspaceInviteCode = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: v.object({
    code: v.string(),
    rotatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const { user } = await requireWorkspaceRole(ctx, args.workspaceId, ["superadmin"]);

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || !workspace.isActive) {
      throw new ConvexError({
        code: "WORKSPACE_INVALID",
        message: "Workspace tidak valid.",
      });
    }

    const now = Date.now();
    const inviteCodes = await ctx.db
      .query("workspace_invite_codes")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .collect();

    const activeInviteCodeIds = listActiveInviteCodeIds(inviteCodes);
    for (const inviteCodeId of activeInviteCodeIds) {
      await ctx.db.patch(inviteCodeId, {
        isActive: false,
        updatedAt: now,
      });
    }

    const code = await generateUniqueInviteCode(ctx, workspace.slug.toUpperCase());
    await ctx.db.insert("workspace_invite_codes", {
      workspaceId: workspace._id,
      code,
      isActive: true,
      expiresAt: undefined,
      createdByUserId: user._id,
      createdAt: now,
      updatedAt: now,
      lastRotatedAt: now,
    });

    return {
      code,
      rotatedAt: now,
    };
  },
});

export const listActiveWorkspaceIds = internalQuery({
  args: {},
  returns: v.array(v.id("workspaces")),
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("workspaces").collect();
    return workspaces.filter((workspace) => workspace.isActive).map((workspace) => workspace._id);
  },
});
