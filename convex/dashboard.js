import { v } from 'convex/values';

import { query } from './_generated/server';
import { buildDateKey, getGlobalSettings, requireRole } from './helpers';

const recentActivityValidator = v.object({
  attendanceId: v.id('attendance'),
  employeeName: v.string(),
  dateKey: v.string(),
  happenedAt: v.number(),
  status: v.union(v.literal('check-in'), v.literal('check-out')),
  edited: v.boolean(),
});

const trendPointValidator = v.object({
  dateKey: v.string(),
  presentCount: v.number(),
  attendanceRatePct: v.number(),
});

const overviewValidator = v.object({
  cards: v.object({
    activeEmployees: v.number(),
    presentToday: v.number(),
    attendanceRatePct: v.number(),
    checkedOut: v.number(),
    editedToday: v.number(),
  }),
  trend7d: v.array(trendPointValidator),
  recentActivity: v.array(recentActivityValidator),
  reportStatus: v.union(
    v.null(),
    v.object({
      weekKey: v.string(),
      status: v.union(v.literal('pending'), v.literal('success'), v.literal('failed')),
      generatedAt: v.optional(v.number()),
      lastTriggeredAt: v.optional(v.number()),
    }),
  ),
});

function computeAttendanceRatePct(presentCount, activeEmployees) {
  if (activeEmployees <= 0) {
    return 0;
  }
  return Number(((presentCount / activeEmployees) * 100).toFixed(1));
}

function buildLast7DateKeys(now, timezone) {
  const dayMs = 24 * 60 * 60 * 1000;
  const keys = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    keys.push(buildDateKey(now - offset * dayMs, timezone));
  }

  return keys;
}

export const getOverview = query({
  args: {},
  returns: overviewValidator,
  handler: async (ctx) => {
    await requireRole(ctx, ['admin', 'superadmin']);

    const settings = await getGlobalSettings(ctx);
    const now = Date.now();
    const todayDateKey = buildDateKey(now, settings.timezone);
    const trendDateKeys = buildLast7DateKeys(now, settings.timezone);

    const activeEmployees = await ctx.db
      .query('users')
      .withIndex('by_role_and_active', (q) => q.eq('role', 'karyawan').eq('isActive', true))
      .collect();

    const todayRows = await ctx.db
      .query('attendance')
      .withIndex('by_date_and_user', (q) => q.eq('dateKey', todayDateKey))
      .collect();

    const trendRowsByDate = await Promise.all(
      trendDateKeys.map((dateKey) =>
        ctx.db
          .query('attendance')
          .withIndex('by_date_and_user', (q) => q.eq('dateKey', dateKey))
          .collect(),
      ),
    );

    const userIds = [...new Set(todayRows.map((row) => String(row.userId)))];
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const usersById = new Map(userIds.map((id, index) => [id, users[index]]));

    let presentToday = 0;
    let checkedOut = 0;
    let editedToday = 0;
    const recentActivity = [];

    for (const row of todayRows) {
      if (row.checkInAt !== undefined) {
        presentToday += 1;
      }
      if (row.checkOutAt !== undefined) {
        checkedOut += 1;
      }
      if (row.edited) {
        editedToday += 1;
      }

      const happenedAt = row.checkOutAt ?? row.checkInAt ?? row.updatedAt;
      const status = row.checkOutAt !== undefined ? 'check-out' : 'check-in';
      recentActivity.push({
        attendanceId: row._id,
        employeeName: usersById.get(String(row.userId))?.name ?? 'Unknown',
        dateKey: row.dateKey,
        happenedAt,
        status,
        edited: row.edited,
      });
    }

    recentActivity.sort((a, b) => b.happenedAt - a.happenedAt);

    const trend7d = trendDateKeys.map((dateKey, index) => {
      const rows = trendRowsByDate[index];
      const presentCount = rows.filter((row) => row.checkInAt !== undefined).length;
      return {
        dateKey,
        presentCount,
        attendanceRatePct: computeAttendanceRatePct(presentCount, activeEmployees.length),
      };
    });

    const latestReport = await ctx.db.query('weekly_reports').order('desc').first();

    return {
      cards: {
        activeEmployees: activeEmployees.length,
        presentToday,
        attendanceRatePct: computeAttendanceRatePct(presentToday, activeEmployees.length),
        checkedOut,
        editedToday,
      },
      trend7d,
      recentActivity: recentActivity.slice(0, 8),
      reportStatus: latestReport
        ? {
            weekKey: latestReport.weekKey,
            status: latestReport.status,
            generatedAt: latestReport.generatedAt,
            lastTriggeredAt: latestReport.lastTriggeredAt,
          }
        : null,
    };
  },
});