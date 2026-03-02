import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { getCurrentDbUser, requireRole } from './helpers';

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
    clerkUserId: v.string(),
    name: v.string(),
    email: v.string(),
    role: v.optional(roleValidator),
  },
  returns: v.id('users'),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_user_id', (q) => q.eq('clerkUserId', args.clerkUserId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        role: args.role ?? existing.role,
        isActive: true,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert('users', {
      clerkUserId: args.clerkUserId,
      name: args.name,
      email: args.email,
      role: args.role ?? 'karyawan',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
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
