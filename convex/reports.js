import { ConvexError, v } from 'convex/values';

import { api, internal } from './_generated/api';
import { action, internalMutation, query } from './_generated/server';
import { requireRole } from './helpers';

const weeklyReportValidator = v.object({
  _id: v.id('weekly_reports'),
  _creationTime: v.number(),
  weekKey: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  fileUrl: v.optional(v.string()),
  storageId: v.optional(v.id('_storage')),
  fileName: v.optional(v.string()),
  mimeType: v.optional(v.string()),
  byteLength: v.optional(v.number()),
  status: v.union(v.literal('pending'), v.literal('success'), v.literal('failed')),
  generatedAt: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
});

export const listWeekly = query({
  args: {},
  returns: v.array(weeklyReportValidator),
  handler: async (ctx) => {
    await requireRole(ctx, ['admin', 'superadmin']);
    return await ctx.db.query('weekly_reports').order('desc').take(20);
  },
});

export const getDownloadUrl = query({
  args: { reportId: v.id('weekly_reports') },
  returns: v.object({
    url: v.optional(v.string()),
    fileName: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, ['admin', 'superadmin']);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Report tidak ditemukan' });
    }

    let url = report.fileUrl;
    if (report.storageId) {
      const storageUrl = await ctx.storage.getUrl(report.storageId);
      url = storageUrl ?? undefined;
    }

    return {
      url,
      fileName: report.fileName ?? `presence_${report.weekKey}.xlsx`,
    };
  },
});

export const markWeeklyReport = internalMutation({
  args: {
    weekKey: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    status: v.union(v.literal('pending'), v.literal('success'), v.literal('failed')),
    fileUrl: v.optional(v.string()),
    storageId: v.optional(v.id('_storage')),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    byteLength: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('weekly_reports')
      .withIndex('by_week_key', (q) => q.eq('weekKey', args.weekKey))
      .unique();

    const patch = {
      startDate: args.startDate,
      endDate: args.endDate,
      status: args.status,
      fileUrl: args.fileUrl,
      storageId: args.storageId,
      fileName: args.fileName,
      mimeType: args.mimeType,
      byteLength: args.byteLength,
      errorMessage: args.errorMessage,
      generatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return null;
    }

    await ctx.db.insert('weekly_reports', {
      weekKey: args.weekKey,
      ...patch,
    });

    return null;
  },
});

export const triggerWeeklyReport = action({
  args: {},
  returns: v.object({
    weekKey: v.string(),
    status: v.string(),
  }),
  handler: async (ctx) => {
    const actor = await ctx.runQuery(api.users.me, {});
    if (!actor || (actor.role !== 'admin' && actor.role !== 'superadmin')) {
      throw new Error('FORBIDDEN');
    }

    return await ctx.runAction(internal.reportsNode.runWeeklyReport, {});
  },
});
