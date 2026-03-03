import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";

import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentDbUser, requireIdentity, requireRole } from "./helpers";
import { isAdminManagedActivationAllowed, isSelfDeactivation } from "./usersPolicy";
import {
  buildUsersMetricsFromRows,
  filterUsers,
  paginateFilteredRows,
  summarizeFromMetrics,
  summarizeUsers,
} from "./usersList";

const roleValidator = v.union(
  v.literal("superadmin"),
  v.literal("admin"),
  v.literal("karyawan"),
  v.literal("device-qr"),
);
const ROLE_KEYS = ["superadmin", "admin", "karyawan", "device-qr"];
const EMPTY_ROLE_BUCKET = { total: 0, active: 0 };

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

function getRoleBucket(metrics, role) {
  return metrics.byRole?.[role] ?? EMPTY_ROLE_BUCKET;
}

function applyTransitionToMetrics(metrics, before, after) {
  const beforeRole = getRoleBucket(metrics, before.role);
  beforeRole.total -= 1;
  if (before.isActive) {
    beforeRole.active -= 1;
    metrics.active -= 1;
  } else {
    metrics.inactive -= 1;
  }

  const afterRole = getRoleBucket(metrics, after.role);
  afterRole.total += 1;
  if (after.isActive) {
    afterRole.active += 1;
    metrics.active += 1;
  } else {
    metrics.inactive += 1;
  }
}

async function getOrRebuildUsersMetrics(ctx) {
  const existing = await ctx.db
    .query("users_metrics")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();

  if (existing) {
    return existing._id;
  }
  return null;
}

async function ensureUsersMetricsForMutation(ctx) {
  const existingId = await getOrRebuildUsersMetrics(ctx);
  if (existingId) {
    return {
      metricsId: existingId,
      createdFromSnapshot: false,
    };
  }

  const allUsers = await ctx.db.query("users").collect();
  const metricsId = await ctx.db.insert(
    "users_metrics",
    buildUsersMetricsFromRows(allUsers, Date.now()),
  );
  return {
    metricsId,
    createdFromSnapshot: true,
  };
}

async function patchUsersMetrics(ctx, updater) {
  const { metricsId, createdFromSnapshot } = await ensureUsersMetricsForMutation(ctx);
  if (createdFromSnapshot) {
    return;
  }

  const metrics = await ctx.db.get(metricsId);
  if (!metrics) {
    return;
  }

  const next = {
    total: metrics.total,
    active: metrics.active,
    inactive: metrics.inactive,
    byRole: Object.fromEntries(
      ROLE_KEYS.map((role) => [role, { ...getRoleBucket(metrics, role) }]),
    ),
    updatedAt: Date.now(),
  };

  updater(next);
  await ctx.db.patch(metricsId, next);
}

function buildUsersQueryBuilder(ctx, args) {
  if (args.role !== undefined && args.isActive !== undefined) {
    return ctx.db
      .query("users")
      .withIndex("by_role_and_active", (q) =>
        q.eq("role", args.role).eq("isActive", args.isActive),
      );
  }

  if (args.role !== undefined) {
    return ctx.db
      .query("users")
      .withIndex("by_role_and_active", (q) => q.eq("role", args.role));
  }

  if (args.isActive !== undefined) {
    return ctx.db
      .query("users")
      .withIndex("by_active", (q) => q.eq("isActive", args.isActive));
  }

  return ctx.db.query("users");
}

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

    await patchUsersMetrics(ctx, (metrics) => {
      metrics.total += 1;
      metrics.active += 1;
      metrics.byRole.karyawan.total += 1;
      metrics.byRole.karyawan.active += 1;
    });

    return inserted;
  },
});

export const listPaginated = query({
  args: {
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
    await requireRole(ctx, ["admin", "superadmin"]);

    const hasSearch = args.q?.trim().length;
    const queryBuilder = buildUsersQueryBuilder(ctx, args).order("desc");

    if (hasSearch) {
      const scopedRows = await queryBuilder.collect();
      const filteredRows = filterUsers(scopedRows, {
        q: args.q,
        role: args.role,
        isActive: args.isActive,
      });
      const rowsPage = paginateFilteredRows(filteredRows, args.paginationOpts);

      return {
        rowsPage,
        summary: summarizeUsers(filteredRows),
      };
    }

    const rowsPage = await queryBuilder.paginate({
      ...args.paginationOpts,
      maximumRowsRead: args.paginationOpts.maximumRowsRead ?? 2_000,
    });

    const metricsId = await getOrRebuildUsersMetrics(ctx);
    if (!metricsId) {
      const scopedRows = await queryBuilder.collect();
      return {
        rowsPage,
        summary: summarizeUsers(scopedRows),
      };
    }

    const metrics = await ctx.db.get(metricsId);
    if (!metrics) {
      const scopedRows = await queryBuilder.collect();
      return {
        rowsPage,
        summary: summarizeUsers(scopedRows),
      };
    }

    return {
      rowsPage,
      summary: summarizeFromMetrics(metrics, {
        role: args.role,
        isActive: args.isActive,
      }),
    };
  },
});

export const updateAdminManagedFields = mutation({
  args: {
    userId: v.id("users"),
    role: v.optional(roleValidator),
    isActive: v.optional(v.boolean()),
  },
  returns: userRowValidator,
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ["admin", "superadmin"]);
    const target = await ctx.db.get(args.userId);

    if (!target) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User tidak ditemukan.",
      });
    }

    if (args.role !== undefined && actor.role !== "superadmin") {
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

    assertAdminManagedTargetPolicy(actor.role, target.role, args.isActive);
    assertSelfDeactivate(actor._id, target._id, args.isActive);

    const nextRole = args.role ?? target.role;
    const nextActive = args.isActive ?? target.isActive;
    const roleChanged = nextRole !== target.role;
    const activeChanged = nextActive !== target.isActive;

    if (!roleChanged && !activeChanged) {
      return target;
    }

    const now = Date.now();
    const patch = { updatedAt: now };
    if (roleChanged) {
      patch.role = nextRole;
    }
    if (activeChanged) {
      patch.isActive = nextActive;
    }

    await ctx.db.patch(args.userId, patch);
    await patchUsersMetrics(ctx, (metrics) => {
      applyTransitionToMetrics(
        metrics,
        { role: target.role, isActive: target.isActive },
        { role: nextRole, isActive: nextActive },
      );
    });

    await ctx.db.insert("audit_logs", {
      actorUserId: actor._id,
      action: "users.admin_managed_fields.updated",
      targetType: "users",
      targetId: String(args.userId),
      payload: {
        role: roleChanged ? nextRole : undefined,
        isActive: activeChanged ? nextActive : undefined,
      },
      createdAt: now,
    });

    const updated = await ctx.db.get(args.userId);
    if (!updated) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User tidak ditemukan setelah update.",
      });
    }

    return updated;
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
    await patchUsersMetrics(ctx, (metrics) => {
      applyTransitionToMetrics(
        metrics,
        { role: target.role, isActive: target.isActive },
        { role: args.role, isActive: target.isActive },
      );
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
    const rebuilt = buildUsersMetricsFromRows(users, now);
    const existing = await ctx.db
      .query("users_metrics")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, rebuilt);
    } else {
      await ctx.db.insert("users_metrics", rebuilt);
    }

    return null;
  },
});
