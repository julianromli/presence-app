'use node';

import { v } from 'convex/values';
import * as XLSX from 'xlsx';

import { internal } from './_generated/api';
import { action, internalAction, internalMutation, query } from './_generated/server';

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function getWeekRange(now = new Date()) {
  const day = now.getUTCDay() || 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { monday, sunday };
}

export const listWeekly = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db.query('weekly_reports').order('desc').take(20);
  },
});

export const markWeeklyReport = internalMutation({
  args: {
    weekKey: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    status: v.union(v.literal('pending'), v.literal('success'), v.literal('failed')),
    fileUrl: v.optional(v.string()),
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

export const runWeeklyReport = internalAction({
  args: {},
  returns: v.object({
    weekKey: v.string(),
    status: v.string(),
  }),
  handler: async (ctx) => {
    const { monday, sunday } = getWeekRange(new Date());
    const weekKey = `${formatDate(monday)}_${formatDate(sunday)}`;

    await ctx.runMutation(internal.reports.markWeeklyReport, {
      weekKey,
      startDate: formatDate(monday),
      endDate: formatDate(sunday),
      status: 'pending',
    });

    try {
      const rows = await ctx.runQuery(internal.attendance.listByDateRangeUnsafe, {
        startDateKey: formatDate(monday),
        endDateKey: formatDate(sunday),
      });

      const worksheetData = rows.map((row) => ({
        'Minggu Ke-': weekKey,
        'Nama Karyawan': row.employeeName,
        'Jam Datang': row.checkInAt ? new Date(row.checkInAt).toISOString() : '-',
        'Jam Pulang': row.checkOutAt ? new Date(row.checkOutAt).toISOString() : '-',
        'Tanggal Kehadiran': row.dateKey,
        'Edited atau Tidak': row.edited ? 'Edited' : 'Tidak',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(wb, ws, 'Presence');
      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;

      await ctx.runMutation(internal.reports.markWeeklyReport, {
        weekKey,
        startDate: formatDate(monday),
        endDate: formatDate(sunday),
        status: 'success',
        fileUrl,
      });

      return { weekKey, status: 'success' };
    } catch (error) {
      await ctx.runMutation(internal.reports.markWeeklyReport, {
        weekKey,
        startDate: formatDate(monday),
        endDate: formatDate(sunday),
        status: 'failed',
        errorMessage: String(error),
      });

      return { weekKey, status: 'failed' };
    }
  },
});

export const triggerWeeklyReport = action({
  args: {},
  returns: v.object({
    weekKey: v.string(),
    status: v.string(),
  }),
  handler: async (ctx) => {
    return await ctx.runAction(internal.reports.runWeeklyReport, {});
  },
});
