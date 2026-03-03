import { ConvexError, v } from 'convex/values';
import { paginationOptsValidator, paginationResultValidator } from 'convex/server';

import { mutation, query } from './_generated/server';
import { getCurrentDbUser, requireIdentity, requireRole } from './helpers';

const roleValidator = v.union(
  v.literal('superadmin'),
  v.literal('admin'),
  v.literal('karyawan'),
  v.literal('device-qr'),
);

export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('users'),
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
  returns: v.id('users'),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const clerkUserId = identity.subject;
    const now = Date.now();
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', clerkUserId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert('users', {
      clerkUserId,
      name: args.name,
      email: args.email,
      role: 'karyawan',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

const userRowValidator = v.object({
  _id: v.id('users'),
  _creationTime: v.number(),
  clerkUserId: v.string(),
  name: v.string(),
  email: v.string(),
  role: roleValidator,
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
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
    summary: v.object({
      total: v.number(),
      active: v.number(),
      inactive: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, ['admin', 'superadmin']);

    let queryBuilder;
    if (args.role !== undefined && args.isActive !== undefined) {
      queryBuilder = ctx.db
        .query('users')
        .withIndex('by_role_and_active', (q) =>
          q.eq('role', args.role).eq('isActive', args.isActive),
        );
    } else if (args.role !== undefined) {
      queryBuilder = ctx.db
        .query('users')
        .withIndex('by_role_and_active', (q) => q.eq('role', args.role));
    } else {
      queryBuilder = ctx.db.query('users');
    }

    const rowsPage = await queryBuilder.order('desc').paginate({
      ...args.paginationOpts,
      maximumRowsRead: args.paginationOpts.maximumRowsRead ?? 2_000,
    });

    let rows = rowsPage.page;
    if (args.isActive !== undefined && args.role === undefined) {
      rows = rows.filter((row) => row.isActive === args.isActive);
    }
    if (args.q && args.q.trim().length > 0) {
      const keyword = args.q.trim().toLocaleLowerCase('id-ID');
      rows = rows.filter((row) => {
        const haystack = `${row.name} ${row.email}`.toLocaleLowerCase('id-ID');
        return haystack.includes(keyword);
      });
    }

    const allRows = await ctx.db.query('users').collect();
    const filteredSummary = allRows.filter((row) => {
      if (args.role !== undefined && row.role !== args.role) {
        return false;
      }
      if (args.isActive !== undefined && row.isActive !== args.isActive) {
        return false;
      }
      if (args.q && args.q.trim().length > 0) {
        const keyword = args.q.trim().toLocaleLowerCase('id-ID');
        const haystack = `${row.name} ${row.email}`.toLocaleLowerCase('id-ID');
        return haystack.includes(keyword);
      }
      return true;
    });

    return {
      rowsPage: {
        ...rowsPage,
        page: rows,
      },
      summary: {
        total: filteredSummary.length,
        active: filteredSummary.filter((row) => row.isActive).length,
        inactive: filteredSummary.filter((row) => !row.isActive).length,
      },
    };
  },
});

export const updateAdminManagedFields = mutation({
  args: {
    userId: v.id('users'),
    role: v.optional(roleValidator),
    isActive: v.optional(v.boolean()),
  },
  returns: userRowValidator,
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ['admin', 'superadmin']);
    const target = await ctx.db.get(args.userId);

    if (!target) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'User tidak ditemukan.',
      });
    }

    if (args.role !== undefined && actor.role !== 'superadmin') {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Hanya superadmin yang dapat mengubah role.',
      });
    }

    if (args.role === undefined && args.isActive === undefined) {
      throw new ConvexError({
        code: 'VALIDATION_ERROR',
        message: 'Tidak ada field yang diubah.',
      });
    }

    const patch = {
      updatedAt: Date.now(),
    };

    if (args.role !== undefined) {
      patch.role = args.role;
    }
    if (args.isActive !== undefined) {
      patch.isActive = args.isActive;
    }

    await ctx.db.patch(args.userId, patch);
    await ctx.db.insert('audit_logs', {
      actorUserId: actor._id,
      action: 'users.admin_managed_fields.updated',
      targetType: 'users',
      targetId: String(args.userId),
      payload: {
        role: args.role,
        isActive: args.isActive,
      },
      createdAt: Date.now(),
    });

    const updated = await ctx.db.get(args.userId);
    if (!updated) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'User tidak ditemukan setelah update.',
      });
    }

    return updated;
  },
});

export const updateRole = mutation({
  args: {
    userId: v.id('users'),
    role: roleValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRole(ctx, ['superadmin']);
    await ctx.db.patch(args.userId, {
      role: args.role,
      updatedAt: Date.now(),
    });
    return null;
  },
});
