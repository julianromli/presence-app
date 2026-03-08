import { v } from "convex/values";

import { query } from "./_generated/server";
import { buildDateKey, getGlobalSettingsOrNull, requireWorkspaceRole } from "./helpers";
import {
  computeDailyPoints,
  computeDisciplineScore,
  computeStreakBonus,
  formatMinutesToClock,
  getCutoffMinutes,
  getMinutesInTimezone,
  isOnTimeCheckIn,
  isWorkday,
  paginateRows,
} from "./employeeDashboardKpi";

const trendPointValidator = v.object({
  dateKey: v.string(),
  checkInMinute: v.union(v.number(), v.null()),
  onTime: v.boolean(),
  hasCheckIn: v.boolean(),
});

const overviewValidator = v.object({
  cards: v.object({
    disciplineScore: v.number(),
    onTimeThisWeek: v.number(),
    lateThisWeek: v.number(),
    avgCheckInTime: v.string(),
    improvementMinutes: v.number(),
    weeklyPoints: v.number(),
    streakDays: v.number(),
  }),
  trend14d: v.array(trendPointValidator),
  insight: v.string(),
  badgeProgress: v.object({
    current: v.union(v.literal("none"), v.literal("bronze"), v.literal("silver"), v.literal("gold")),
    next: v.union(v.literal("bronze"), v.literal("silver"), v.literal("gold"), v.null()),
    currentPoints: v.number(),
    targetPoints: v.union(v.number(), v.null()),
    remainingPoints: v.union(v.number(), v.null()),
  }),
});

const attendanceHistoryRowValidator = v.object({
  attendanceId: v.id("attendance"),
  dateKey: v.string(),
  checkInAt: v.optional(v.number()),
  checkOutAt: v.optional(v.number()),
  status: v.union(
    v.literal("on-time"),
    v.literal("late"),
    v.literal("incomplete"),
    v.literal("absent"),
  ),
  workDurationMinutes: v.number(),
  edited: v.boolean(),
  points: v.number(),
});

const attendanceHistoryValidator = v.object({
  timeZone: v.string(),
  rows: v.array(attendanceHistoryRowValidator),
  pageInfo: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  summary: v.object({
    totalRows: v.number(),
    onTime: v.number(),
    late: v.number(),
    incomplete: v.number(),
    absent: v.number(),
  }),
});

const attendanceByDateValidator = v.object({
  timeZone: v.string(),
  row: v.union(attendanceHistoryRowValidator, v.null()),
});

const leaderboardRowValidator = v.object({
  userId: v.id("users"),
  name: v.string(),
  points: v.number(),
  onTimeDays: v.number(),
  streakDays: v.number(),
  disciplineScore: v.number(),
  rank: v.number(),
  isMe: v.boolean(),
});

const leaderboardValidator = v.object({
  weekLabel: v.string(),
  myRank: v.union(v.number(), v.null()),
  myPoints: v.number(),
  rows: v.array(leaderboardRowValidator),
});

function buildRecentDateKeys(now, timezone, days) {
  const dayMs = 24 * 60 * 60 * 1000;
  const keys = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    keys.push(buildDateKey(now - offset * dayMs, timezone));
  }
  return keys;
}

function resolveTimezone(settings) {
  return settings?.timezone ?? "Asia/Jakarta";
}

function toHistoryStatus(row, timezone, cutoffMinutes) {
  if (row.checkInAt === undefined) {
    return "absent";
  }
  if (row.checkOutAt === undefined) {
    return "incomplete";
  }
  return isOnTimeCheckIn(row.checkInAt, timezone, cutoffMinutes) ? "on-time" : "late";
}

function computeDurationMinutes(checkInAt, checkOutAt) {
  if (checkInAt === undefined || checkOutAt === undefined || checkOutAt < checkInAt) {
    return 0;
  }
  return Math.round((checkOutAt - checkInAt) / 60000);
}

function resolveBadgeProgress(points) {
  const levels = [
    { key: "bronze", target: 30 },
    { key: "silver", target: 60 },
    { key: "gold", target: 90 },
  ];

  if (points >= 90) {
    return {
      current: "gold",
      next: null,
      currentPoints: points,
      targetPoints: null,
      remainingPoints: null,
    };
  }

  const nextLevel = levels.find((level) => points < level.target);
  const current =
    points >= 60 ? "silver" : points >= 30 ? "bronze" : "none";

  return {
    current,
    next: nextLevel?.key ?? null,
    currentPoints: points,
    targetPoints: nextLevel?.target ?? null,
    remainingPoints: nextLevel ? Math.max(0, nextLevel.target - points) : null,
  };
}

function safeAverage(minutes) {
  if (minutes.length === 0) {
    return null;
  }
  const sum = minutes.reduce((acc, value) => acc + value, 0);
  return Math.round(sum / minutes.length);
}

function currentStreakFromRows(rowsByDateKey, orderedDateKeys, timezone, cutoffMinutes) {
  let streak = 0;
  for (let index = orderedDateKeys.length - 1; index >= 0; index -= 1) {
    const dateKey = orderedDateKeys[index];
    if (!isWorkday(dateKey)) {
      continue;
    }
    const row = rowsByDateKey.get(dateKey);
    if (!row || row.checkInAt === undefined) {
      break;
    }
    if (!isOnTimeCheckIn(row.checkInAt, timezone, cutoffMinutes)) {
      break;
    }
    streak += 1;
  }
  return streak;
}

function buildInsight(onTimeThisWeek, lateThisWeek, improvementMinutes) {
  if (onTimeThisWeek === 0 && lateThisWeek === 0) {
    return "Belum ada check-in minggu ini. Mulai check-in tepat waktu untuk membangun streak.";
  }
  if (improvementMinutes > 0) {
    return `Kamu datang rata-rata ${improvementMinutes} menit lebih awal dibanding minggu lalu. Pertahankan ritme ini.`;
  }
  if (improvementMinutes < 0) {
    return `Rata-rata check-in ${Math.abs(improvementMinutes)} menit lebih lambat dari minggu lalu. Targetkan 1 hari tepat waktu tambahan besok.`;
  }
  if (lateThisWeek === 0) {
    return "Performa disiplin stabil dan tanpa keterlambatan minggu ini.";
  }
  return "Performa stabil. Fokuskan pada check-in sebelum batas waktu untuk naikkan skor disiplin.";
}

export const getOverview = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: overviewValidator,
  handler: async (ctx, args) => {
    const { user } = await requireWorkspaceRole(ctx, args.workspaceId, ["karyawan"]);
    const settings = await getGlobalSettingsOrNull(ctx, args.workspaceId);
    const timezone = resolveTimezone(settings);
    const cutoffMinutes = getCutoffMinutes();
    const now = Date.now();

    const recent30Keys = buildRecentDateKeys(now, timezone, 30);
    const weekKeys = buildRecentDateKeys(now, timezone, 7);
    const prevWeekKeys = buildRecentDateKeys(now - 7 * 24 * 60 * 60 * 1000, timezone, 7);
    const trend14Keys = buildRecentDateKeys(now, timezone, 14);

    const allRows = await ctx.db
      .query("attendance")
      .withIndex("by_workspace_user_date", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("userId", user._id)
          .gte("dateKey", recent30Keys[0]),
      )
      .collect();
    const rowsByDateKey = new Map(allRows.map((row) => [row.dateKey, row]));

    const recentRows = recent30Keys
      .map((dateKey) => rowsByDateKey.get(dateKey))
      .filter((row) => row !== undefined);

    const checkInMinutes30 = recentRows
      .filter((row) => row.checkInAt !== undefined)
      .map((row) => getMinutesInTimezone(row.checkInAt, timezone));
    const avgCheckInMinutes = safeAverage(checkInMinutes30);

    let onTimeThisWeek = 0;
    let lateThisWeek = 0;
    let weeklyBasePoints = 0;
    const streakSequence = [];

    for (const dateKey of weekKeys) {
      if (!isWorkday(dateKey)) {
        continue;
      }
      const row = rowsByDateKey.get(dateKey);
      if (!row || row.checkInAt === undefined) {
        streakSequence.push(false);
        continue;
      }
      const onTime = isOnTimeCheckIn(row.checkInAt, timezone, cutoffMinutes);
      if (onTime) {
        onTimeThisWeek += 1;
      } else {
        lateThisWeek += 1;
      }
      weeklyBasePoints += computeDailyPoints(row, timezone, cutoffMinutes);
      streakSequence.push(onTime);
    }

    const weeklyStreakBonus = computeStreakBonus(streakSequence);
    const weeklyPoints = weeklyBasePoints + weeklyStreakBonus;
    const workdayCount = weekKeys.filter((dateKey) => isWorkday(dateKey)).length;
    const disciplineScore = computeDisciplineScore(weeklyPoints, workdayCount);
    const streakDays = currentStreakFromRows(rowsByDateKey, weekKeys, timezone, cutoffMinutes);

    const thisWeekCheckInMinutes = weekKeys
      .map((dateKey) => rowsByDateKey.get(dateKey))
      .filter((row) => row && row.checkInAt !== undefined && isWorkday(row.dateKey))
      .map((row) => getMinutesInTimezone(row.checkInAt, timezone));
    const prevWeekCheckInMinutes = prevWeekKeys
      .map((dateKey) => rowsByDateKey.get(dateKey))
      .filter((row) => row && row.checkInAt !== undefined && isWorkday(row.dateKey))
      .map((row) => getMinutesInTimezone(row.checkInAt, timezone));

    const avgThisWeek = safeAverage(thisWeekCheckInMinutes);
    const avgPrevWeek = safeAverage(prevWeekCheckInMinutes);
    const improvementMinutes =
      avgThisWeek === null || avgPrevWeek === null ? 0 : avgPrevWeek - avgThisWeek;

    const trend14d = trend14Keys.map((dateKey) => {
      const row = rowsByDateKey.get(dateKey);
      if (!row || row.checkInAt === undefined) {
        return {
          dateKey,
          checkInMinute: null,
          onTime: false,
          hasCheckIn: false,
        };
      }
      const checkInMinute = getMinutesInTimezone(row.checkInAt, timezone);
      return {
        dateKey,
        checkInMinute,
        onTime: checkInMinute <= cutoffMinutes,
        hasCheckIn: true,
      };
    });

    return {
      cards: {
        disciplineScore,
        onTimeThisWeek,
        lateThisWeek,
        avgCheckInTime:
          avgCheckInMinutes === null ? "-" : formatMinutesToClock(avgCheckInMinutes),
        improvementMinutes,
        weeklyPoints,
        streakDays,
      },
      trend14d,
      insight: buildInsight(onTimeThisWeek, lateThisWeek, improvementMinutes),
      badgeProgress: resolveBadgeProgress(weeklyPoints),
    };
  },
});

export const listAttendanceHistory = query({
  args: {
    workspaceId: v.id("workspaces"),
    range: v.union(v.literal("7d"), v.literal("30d"), v.literal("90d")),
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  returns: attendanceHistoryValidator,
  handler: async (ctx, args) => {
    const { user } = await requireWorkspaceRole(ctx, args.workspaceId, ["karyawan"]);
    const settings = await getGlobalSettingsOrNull(ctx, args.workspaceId);
    const timezone = resolveTimezone(settings);
    const cutoffMinutes = getCutoffMinutes();

    const days = args.range === "7d" ? 7 : args.range === "90d" ? 90 : 30;
    const dateKeys = buildRecentDateKeys(Date.now(), timezone, days);

    const allRows = await ctx.db
      .query("attendance")
      .withIndex("by_workspace_user_date", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("userId", user._id)
          .gte("dateKey", dateKeys[0]),
      )
      .collect();
    const rowsByDateKey = new Map(allRows.map((row) => [row.dateKey, row]));

    const normalizedRows = [...dateKeys]
      .reverse()
      .map((dateKey) => {
        const row = rowsByDateKey.get(dateKey);
        if (!row) {
          return null;
        }

        return {
          attendanceId: row._id,
          dateKey,
          checkInAt: row.checkInAt,
          checkOutAt: row.checkOutAt,
          status: toHistoryStatus(row, timezone, cutoffMinutes),
          workDurationMinutes: computeDurationMinutes(row.checkInAt, row.checkOutAt),
          edited: row.edited,
          points: computeDailyPoints(row, timezone, cutoffMinutes),
        };
      })
      .filter((item) => item !== null);

    const page = paginateRows(normalizedRows, args.paginationOpts);
    const workdayCount = dateKeys.filter((dateKey) => isWorkday(dateKey)).length;
    const summary = {
      totalRows: normalizedRows.length,
      onTime: normalizedRows.filter((row) => row.status === "on-time").length,
      late: normalizedRows.filter((row) => row.status === "late").length,
      incomplete: normalizedRows.filter((row) => row.status === "incomplete").length,
      absent: Math.max(
        0,
        workdayCount -
          normalizedRows.filter((row) => row.status !== "absent").length,
      ),
    };

    return {
      timeZone: timezone,
      rows: page.page,
      pageInfo: {
        continueCursor: page.continueCursor,
        isDone: page.isDone,
      },
      summary,
    };
  },
});

export const getAttendanceByDate = query({
  args: {
    workspaceId: v.id("workspaces"),
    dateKey: v.string(),
  },
  returns: attendanceByDateValidator,
  handler: async (ctx, args) => {
    const { user } = await requireWorkspaceRole(ctx, args.workspaceId, ["karyawan"]);
    const settings = await getGlobalSettingsOrNull(ctx, args.workspaceId);
    const timezone = resolveTimezone(settings);
    const cutoffMinutes = getCutoffMinutes();

    const matchingRows = await ctx.db
      .query("attendance")
      .withIndex("by_workspace_user_date", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("userId", user._id)
          .eq("dateKey", args.dateKey),
      )
      .collect();
    const row = matchingRows[matchingRows.length - 1] ?? null;

    if (matchingRows.length > 1) {
      console.warn("[attendance-by-date-duplicate]", {
        workspaceId: String(args.workspaceId),
        userId: String(user._id),
        dateKey: args.dateKey,
        count: matchingRows.length,
      });
    }

    if (!row) {
      return {
        timeZone: timezone,
        row: null,
      };
    }

    return {
      timeZone: timezone,
      row: {
        attendanceId: row._id,
        dateKey: row.dateKey,
        checkInAt: row.checkInAt,
        checkOutAt: row.checkOutAt,
        status: toHistoryStatus(row, timezone, cutoffMinutes),
        workDurationMinutes: computeDurationMinutes(row.checkInAt, row.checkOutAt),
        edited: row.edited,
        points: computeDailyPoints(row, timezone, cutoffMinutes),
      },
    };
  },
});

export const getLeaderboard = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: leaderboardValidator,
  handler: async (ctx, args) => {
    const { user } = await requireWorkspaceRole(ctx, args.workspaceId, ["karyawan"]);
    const settings = await getGlobalSettingsOrNull(ctx, args.workspaceId);
    const timezone = resolveTimezone(settings);
    const cutoffMinutes = getCutoffMinutes();
    const now = Date.now();
    const weekKeys = buildRecentDateKeys(now, timezone, 7);
    const weekStart = weekKeys[0];
    const weekEnd = weekKeys[weekKeys.length - 1];

    const members = await ctx.db
      .query("workspace_members")
      .withIndex("by_workspace_role_active", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("role", "karyawan").eq("isActive", true),
      )
      .collect();

    const userIds = members.map((member) => member.userId);
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const namesByUserId = new Map(
      userIds.map((id, index) => [String(id), users[index]?.name ?? "Karyawan"]),
    );

    const pointsByUserId = new Map();
    const onTimeByUserId = new Map();
    const streakByUserId = new Map();

    for (const member of members) {
      pointsByUserId.set(String(member.userId), 0);
      onTimeByUserId.set(String(member.userId), 0);
      streakByUserId.set(String(member.userId), 0);
    }

    const weekRows = await Promise.all(
      weekKeys.map((dateKey) =>
        ctx.db
          .query("attendance")
          .withIndex("by_workspace_and_date_user", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("dateKey", dateKey),
          )
          .collect(),
      ),
    );
    const weekRowsByKey = new Map(
      weekKeys.map((dateKey, index) => [
        dateKey,
        new Map((weekRows[index] ?? []).map((row) => [String(row.userId), row])),
      ]),
    );

    for (const member of members) {
      const sequence = [];
      let totalPoints = 0;
      let onTimeDays = 0;

      for (const dateKey of weekKeys) {
        if (!isWorkday(dateKey)) {
          continue;
        }
        const row = weekRowsByKey.get(dateKey)?.get(String(member.userId));
        if (!row || row.checkInAt === undefined) {
          sequence.push(false);
          continue;
        }

        const onTime = isOnTimeCheckIn(row.checkInAt, timezone, cutoffMinutes);
        if (onTime) {
          onTimeDays += 1;
        }
        sequence.push(onTime);
        totalPoints += computeDailyPoints(row, timezone, cutoffMinutes);
      }

      totalPoints += computeStreakBonus(sequence);
      let streakDays = 0;
      for (let index = sequence.length - 1; index >= 0; index -= 1) {
        if (!sequence[index]) {
          break;
        }
        streakDays += 1;
      }

      pointsByUserId.set(String(member.userId), totalPoints);
      onTimeByUserId.set(String(member.userId), onTimeDays);
      streakByUserId.set(String(member.userId), streakDays);
    }

    const workdayCount = weekKeys.filter((dateKey) => isWorkday(dateKey)).length;
    const ranked = members
      .map((member) => {
        const key = String(member.userId);
        const points = pointsByUserId.get(key) ?? 0;
        return {
          userId: member.userId,
          name: namesByUserId.get(key) ?? "Karyawan",
          points,
          onTimeDays: onTimeByUserId.get(key) ?? 0,
          streakDays: streakByUserId.get(key) ?? 0,
          disciplineScore: computeDisciplineScore(points, workdayCount),
        };
      })
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.onTimeDays !== a.onTimeDays) return b.onTimeDays - a.onTimeDays;
        return a.name.localeCompare(b.name, "id-ID");
      })
      .map((row, index) => ({
        ...row,
        rank: index + 1,
        isMe: String(row.userId) === String(user._id),
      }));

    const myRow = ranked.find((row) => row.isMe) ?? null;

    return {
      weekLabel: `${weekStart} s/d ${weekEnd}`,
      myRank: myRow?.rank ?? null,
      myPoints: myRow?.points ?? 0,
      rows: ranked.slice(0, 10),
    };
  },
});
