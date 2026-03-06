import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";

import { internalMutation, mutation, query } from "./_generated/server";
import {
  getCurrentDbUser,
  requireIdentity,
  requireRole,
  requireWorkspaceRole,
} from "./helpers";
import { isAdminManagedActivationAllowed, isSelfDeactivation } from "./usersPolicy";
import { isLastActiveSuperadminTransition } from "./workspaceMembersPolicy";
import {
  filterUsers,
  paginateFilteredRows,
  summarizeUsers,
} from "./usersList";
import {
  buildGlobalUsersMetricsSnapshot,
  listGlobalUsersMetricsRows,
  pickCanonicalUsersMetricsRow,
} from "./usersMetrics";

const roleValidator = v.union(
  v.literal("superadmin"),
  v.literal("admin"),
  v.literal("karyawan"),
  v.literal("device-qr"),
);

const summaryValidator = v.object({
  total: v.number(),
  active: v.number(),
  inactive: v.number(),
});

const userRowValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  clerkUserId: v.string(),
  name: v.string(),
  email: v.string(),
  role: roleValidator,
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

function assertAdminManagedTargetPolicy(actorRole, targetRole, nextActive) {
  if (actorRole !== "admin" || nextActive === undefined) {
    return;
  }

  if (!isAdminManagedActivationAllowed(actorRole, targetRole)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Admin hanya dapat mengubah status user karyawan atau device-qr.",
    });
  }
}

function assertSelfDeactivate(actorId, targetId, nextActive) {
  if (!isSelfDeactivation(actorId, targetId, nextActive)) {
    return;
  }
  throw new ConvexError({
    code: "FORBIDDEN",
    message: "Anda tidak dapat menonaktifkan akun sendiri.",
  });
}

async function assertWorkspaceHasAnotherActiveSuperadmin(ctx, workspaceId, membership, nextRole, nextActive) {
  const activeSuperadmins = await ctx.db
    .query("workspace_members")
    .withIndex("by_workspace_role_active", (q) =>
      q.eq("workspaceId", workspaceId).eq("role", "superadmin").eq("isActive", true),
    )
    .collect();

  if (
    isLastActiveSuperadminTransition({
      currentRole: membership.role,
      currentActive: membership.isActive,
      nextRole,
      nextActive,
      activeSuperadminCount: activeSuperadmins.length,
    })
  ) {
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: "Workspace harus memiliki minimal satu superadmin aktif.",
    });
  }
}

export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
      role: roleValidator,
      isActive: v.boolean(),
      clerkUserId: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx) => {
    try {
      return await getCurrentDbUser(ctx);
    } catch {
      return null;
    }
  },
});

export const upsertFromClerk = mutation({
  args: {
    name: v.string(),
    email: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const clerkUserId = identity.subject;
    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        updatedAt: now,
      });
      return existing._id;
    }

    const inserted = await ctx.db.insert("users", {
      clerkUserId,
      name: args.name,
      email: args.email,
      role: "karyawan",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return inserted;
  },
});

export const listPaginated = query({
  args: {
    workspaceId: v.id("workspaces"),
    q: v.optional(v.string()),
    role: v.optional(roleValidator),
    isActive: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    rowsPage: paginationResultValidator(userRowValidator),
    summary: summaryValidator,
  }),
  handler: async (ctx, args) => {
    await requireWorkspaceRole(ctx, args.workspaceId, ["admin", "superadmin"]);

    const memberships = await ctx.db
      .query("workspace_members")
      .withIndex("by_workspace_role_active", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();

    const scopedMemberships = memberships.filter((membership) => {
      if (args.role !== undefined && membership.role !== args.role) {
        return false;
      }
      if (args.isActive !== undefined && membership.isActive !== args.isActive) {
        return false;
      }
      return true;
    });

    const userIds = [...new Set(scopedMemberships.map((item) => String(item.userId)))];
    const userDocs = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const userById = new Map(userIds.map((id, idx) => [id, userDocs[idx]]));

    const rows = scopedMemberships
      .map((membership) => {
        const user = userById.get(String(membership.userId));
        if (!user) {
          return null;
        }
        return {
          _id: user._id,
          _creationTime: user._creationTime,
          clerkUserId: user.clerkUserId,
          name: user.name,
          email: user.email,
          role: membership.role,
          isActive: membership.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      })
      .filter((item) => item !== null);

    const filteredRows = filterUsers(rows, {
      q: args.q,
      role: args.role,
      isActive: args.isActive,
    });
    const rowsPage = paginateFilteredRows(filteredRows, args.paginationOpts);

    return {
      rowsPage,
      summary: summarizeUsers(filteredRows),
    };
  },
});

export const updateAdminManagedFields = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.optional(roleValidator),
    isActive: v.optional(v.boolean()),
  },
  returns: userRowValidator,
  handler: async (ctx, args) => {
    const { user: actor, membership: actorMembership } = await requireWorkspaceRole(
      ctx,
      args.workspaceId,
      ["admin", "superadmin"],
    );

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User tidak ditemukan.",
      });
    }

    const membership = await ctx.db
      .query("workspace_members")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId),
      )
      .unique();

    if (!membership) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Membership workspace tidak ditemukan.",
      });
    }

    if (args.role !== undefined && actorMembership.role !== "superadmin") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Hanya superadmin yang dapat mengubah role.",
      });
    }

    if (args.role === undefined && args.isActive === undefined) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Tidak ada field yang diubah.",
      });
    }

    assertAdminManagedTargetPolicy(actorMembership.role, membership.role, args.isActive);
    assertSelfDeactivate(actor._id, membership.userId, args.isActive);

    const nextRole = args.role ?? membership.role;
    const nextActive = args.isActive ?? membership.isActive;
    const roleChanged = nextRole !== membership.role;
    const activeChanged = nextActive !== membership.isActive;

    await assertWorkspaceHasAnotherActiveSuperadmin(
      ctx,
      args.workspaceId,
      membership,
      nextRole,
      nextActive,
    );

    if (!roleChanged && !activeChanged) {
      return {
        _id: targetUser._id,
        _creationTime: targetUser._creationTime,
        clerkUserId: targetUser.clerkUserId,
        name: targetUser.name,
        email: targetUser.email,
        role: membership.role,
        isActive: membership.isActive,
        createdAt: targetUser.createdAt,
        updatedAt: targetUser.updatedAt,
      };
    }

    const now = Date.now();
    const patch = { updatedAt: now };
    if (roleChanged) {
      patch.role = nextRole;
    }
    if (activeChanged) {
      patch.isActive = nextActive;
    }

    await ctx.db.patch(membership._id, patch);

    await ctx.db.insert("audit_logs", {
      actorUserId: actor._id,
      workspaceId: args.workspaceId,
      action: "workspace_members.admin_managed_fields.updated",
      targetType: "workspace_members",
      targetId: String(membership._id),
      payload: {
        role: roleChanged ? nextRole : undefined,
        isActive: activeChanged ? nextActive : undefined,
      },
      createdAt: now,
    });

    return {
      _id: targetUser._id,
      _creationTime: targetUser._creationTime,
      clerkUserId: targetUser.clerkUserId,
      name: targetUser.name,
      email: targetUser.email,
      role: nextRole,
      isActive: nextActive,
      createdAt: targetUser.createdAt,
      updatedAt: targetUser.updatedAt,
    };
  },
});

export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    role: roleValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["superadmin"]);
    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User tidak ditemukan.",
      });
    }

    if (target.role === args.role) {
      return null;
    }

    await ctx.db.patch(args.userId, {
      role: args.role,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const rebuildUsersMetrics = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const users = await ctx.db.query("users").collect();
    const rebuilt = buildGlobalUsersMetricsSnapshot(users, now);
    const globalRows = await listGlobalUsersMetricsRows(ctx);
    const canonical = pickCanonicalUsersMetricsRow(globalRows);

    if (canonical) {
      await ctx.db.patch(canonical._id, rebuilt);
      for (const row of globalRows) {
        if (row._id !== canonical._id) {
          await ctx.db.delete(row._id);
        }
      }
    } else {
      await ctx.db.insert("users_metrics", rebuilt);
    }

    return null;
  },
});
