"use node";

import { v } from "convex/values";
import * as XLSX from "xlsx";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_TO_NUMBER = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function dateKeyFromTimestamp(ts, timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts));
}

function normalizeTimezone(timezone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "Asia/Jakarta";
  }
}

function getWeekRangeDateKeys(nowTs, timezone) {
  const weekdayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(new Date(nowTs));
  const weekday = WEEKDAY_TO_NUMBER[weekdayLabel] ?? 1;

  const mondayOffset = 1 - weekday;
  const sundayOffset = 7 - weekday;

  return {
    mondayKey: dateKeyFromTimestamp(nowTs + mondayOffset * DAY_MS, timezone),
    sundayKey: dateKeyFromTimestamp(nowTs + sundayOffset * DAY_MS, timezone),
  };
}

export const runWeeklyReport = internalAction({
  args: {
    triggerSource: v.union(v.literal("manual"), v.literal("cron")),
    triggeredBy: v.optional(v.id("users")),
  },
  returns: v.object({
    weekKey: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("failed"),
    ),
    skipped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.settings.ensureGlobalInternal, {});
    const settings = await ctx.runQuery(internal.settings.getGlobalUnsafe, {});
    const timezone = normalizeTimezone(settings.timezone);
    const nowTs = Date.now();
    const { mondayKey, sundayKey } = getWeekRangeDateKeys(nowTs, timezone);
    const weekKey = `${mondayKey}_${sundayKey}`;
    const startDate = mondayKey;
    const endDate = sundayKey;

    const begin = await ctx.runMutation(internal.reports.beginWeeklyReport, {
      weekKey,
      startDate,
      endDate,
      triggerSource: args.triggerSource,
      triggeredBy: args.triggeredBy,
    });

    if (!begin.runGeneration) {
      return { weekKey, status: begin.status, skipped: true };
    }

    try {
      const rows = await ctx.runQuery(
        internal.attendance.listByDateRangeUnsafe,
        {
          startDateKey: startDate,
          endDateKey: endDate,
        },
      );

      const worksheetData = rows.map((row) => ({
        "Minggu Ke-": weekKey,
        "Nama Karyawan": row.employeeName,
        "Jam Datang": row.checkInAt
          ? new Date(row.checkInAt).toISOString()
          : "-",
        "Jam Pulang": row.checkOutAt
          ? new Date(row.checkOutAt).toISOString()
          : "-",
        "Tanggal Kehadiran": row.dateKey,
        "Edited atau Tidak": row.edited ? "Edited" : "Tidak",
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(wb, ws, "Presence");
      const fileArrayBuffer = XLSX.write(wb, {
        type: "array",
        bookType: "xlsx",
      });
      const fileBlob = new Blob([fileArrayBuffer], { type: XLSX_MIME });
      const storageId = await ctx.storage.store(fileBlob);
      const fileUrl = await ctx.storage.getUrl(storageId);
      const fileName = `presence_${weekKey}.xlsx`;
      const finishedAt = Date.now();

      await ctx.runMutation(internal.reports.markWeeklyReport, {
        weekKey,
        startDate,
        endDate,
        status: "success",
        fileUrl: fileUrl ?? undefined,
        storageId,
        fileName,
        mimeType: XLSX_MIME,
        byteLength: fileBlob.size,
        startedAt: begin.startedAt,
        finishedAt,
        durationMs: Math.max(0, finishedAt - begin.startedAt),
        triggerSource: args.triggerSource,
        triggeredBy: args.triggeredBy,
        lastTriggeredAt: finishedAt,
        attempts: begin.attempts,
      });

      return { weekKey, status: "success", skipped: false };
    } catch (error) {
      const finishedAt = Date.now();
      await ctx.runMutation(internal.reports.markWeeklyReport, {
        weekKey,
        startDate,
        endDate,
        status: "failed",
        errorMessage: String(error),
        startedAt: begin.startedAt,
        finishedAt,
        durationMs: Math.max(0, finishedAt - begin.startedAt),
        triggerSource: args.triggerSource,
        triggeredBy: args.triggeredBy,
        lastTriggeredAt: finishedAt,
        attempts: begin.attempts,
      });

      return { weekKey, status: "failed", skipped: false };
    }
  },
});
