import { ConvexError, v } from "convex/values";

import { api, internal } from "./_generated/api";
import { action, internalMutation, query } from "./_generated/server";
import { requireRole } from "./helpers";

const triggerSourceValidator = v.union(v.literal("manual"), v.literal("cron"));
const weeklyStatusValidator = v.union(
  v.literal("pending"),
  v.literal("success"),
  v.literal("failed"),
);

const weeklyReportValidator = v.object({
  _id: v.id("weekly_reports"),
  _creationTime: v.number(),
  weekKey: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  fileUrl: v.optional(v.string()),
  storageId: v.optional(v.id("_storage")),
  fileName: v.optional(v.string()),
  mimeType: v.optional(v.string()),
  byteLength: v.optional(v.number()),
  status: weeklyStatusValidator,
  generatedAt: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
  startedAt: v.optional(v.number()),
  finishedAt: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  triggerSource: v.optional(triggerSourceValidator),
  triggeredBy: v.optional(v.id("users")),
  lastTriggeredAt: v.optional(v.number()),
  attempts: v.optional(v.number()),
});

export const listWeekly = query({
  args: {},
  returns: v.array(weeklyReportValidator),
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "superadmin"]);
    return await ctx.db.query("weekly_reports").order("desc").take(20);
  },
});

export const getDownloadUrl = query({
  args: { reportId: v.id("weekly_reports") },
  returns: v.object({
    url: v.optional(v.string()),
    fileName: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "superadmin"]);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Report tidak ditemukan",
      });
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
    status: weeklyStatusValidator,
    fileUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    byteLength: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    triggerSource: v.optional(triggerSourceValidator),
    triggeredBy: v.optional(v.id("users")),
    lastTriggeredAt: v.optional(v.number()),
    attempts: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("weekly_reports")
      .withIndex("by_week_key", (q) => q.eq("weekKey", args.weekKey))
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
      startedAt: args.startedAt,
      finishedAt: args.finishedAt,
      durationMs: args.durationMs,
      triggerSource: args.triggerSource,
      triggeredBy: args.triggeredBy,
      lastTriggeredAt: args.lastTriggeredAt,
      attempts: args.attempts,
      generatedAt:
        args.status === "pending"
          ? existing?.generatedAt
          : (args.finishedAt ?? Date.now()),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return null;
    }

    await ctx.db.insert("weekly_reports", {
      weekKey: args.weekKey,
      ...patch,
    });

    return null;
  },
});

export const beginWeeklyReport = internalMutation({
  args: {
    weekKey: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    triggerSource: triggerSourceValidator,
    triggeredBy: v.optional(v.id("users")),
  },
  returns: v.object({
    reportId: v.id("weekly_reports"),
    runGeneration: v.boolean(),
    status: weeklyStatusValidator,
    startedAt: v.number(),
    attempts: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("weekly_reports")
      .withIndex("by_week_key", (q) => q.eq("weekKey", args.weekKey))
      .unique();

    if (existing) {
      if (existing.status === "success" || existing.status === "pending") {
        await ctx.db.patch(existing._id, {
          lastTriggeredAt: now,
          triggerSource: args.triggerSource,
          triggeredBy: args.triggeredBy,
        });

        return {
          reportId: existing._id,
          runGeneration: false,
          status: existing.status,
          startedAt: existing.startedAt ?? now,
          attempts: existing.attempts ?? 1,
        };
      }

      const attempts = (existing.attempts ?? 0) + 1;
      await ctx.db.patch(existing._id, {
        startDate: args.startDate,
        endDate: args.endDate,
        status: "pending",
        errorMessage: undefined,
        fileUrl: undefined,
        storageId: undefined,
        fileName: undefined,
        mimeType: undefined,
        byteLength: undefined,
        startedAt: now,
        finishedAt: undefined,
        durationMs: undefined,
        triggerSource: args.triggerSource,
        triggeredBy: args.triggeredBy,
        lastTriggeredAt: now,
        attempts,
      });

      return {
        reportId: existing._id,
        runGeneration: true,
        status: "pending",
        startedAt: now,
        attempts,
      };
    }

    const reportId = await ctx.db.insert("weekly_reports", {
      weekKey: args.weekKey,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "pending",
      generatedAt: undefined,
      errorMessage: undefined,
      fileUrl: undefined,
      storageId: undefined,
      fileName: undefined,
      mimeType: undefined,
      byteLength: undefined,
      startedAt: now,
      finishedAt: undefined,
      durationMs: undefined,
      triggerSource: args.triggerSource,
      triggeredBy: args.triggeredBy,
      lastTriggeredAt: now,
      attempts: 1,
    });

    return {
      reportId,
      runGeneration: true,
      status: "pending",
      startedAt: now,
      attempts: 1,
    };
  },
});

export const triggerWeeklyReport = action({
  args: {},
  returns: v.object({
    weekKey: v.string(),
    status: weeklyStatusValidator,
    skipped: v.boolean(),
  }),
  handler: async (ctx) => {
    const actor = await ctx.runQuery(api.users.me, {});
    if (!actor || (actor.role !== "admin" && actor.role !== "superadmin")) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Role tidak diizinkan",
      });
    }

    return await ctx.runAction(internal.reportsNode.runWeeklyReport, {
      triggerSource: "manual",
      triggeredBy: actor._id,
    });
  },
});
