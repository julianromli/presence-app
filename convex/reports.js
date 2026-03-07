import { ConvexError, v } from "convex/values";

import { api, internal } from "./_generated/api";
import { action, internalMutation, query } from "./_generated/server";
import { requireWorkspaceRole } from "./helpers";
import { decideWeeklyReportStart } from "./reportIdempotency";

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
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: v.array(weeklyReportValidator),
  handler: async (ctx, args) => {
    await requireWorkspaceRole(ctx, args.workspaceId, ["admin", "superadmin"]);
    return await ctx.db
      .query("weekly_reports")
      .withIndex("by_workspace_week_key", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .take(20);
  },
});

export const getDownloadUrl = query({
  args: {
    reportId: v.id("weekly_reports"),
    workspaceId: v.id("workspaces"),
  },
  returns: v.object({
    url: v.optional(v.string()),
    fileName: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireWorkspaceRole(ctx, args.workspaceId, ["admin", "superadmin"]);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Report tidak ditemukan",
      });
    }
    if (report.workspaceId !== args.workspaceId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Report bukan milik workspace aktif.",
      });
    }

    let url = report.fileUrl;
    if (report.storageId) {
      const storageUrl = await ctx.storage.getUrl(report.storageId);
      url = storageUrl ?? undefined;
    }

    return {
      url,
      fileName: report.fileName ?? `absenin_id_${report.weekKey}.xlsx`,
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
    workspaceId: v.id("workspaces"),
    lastTriggeredAt: v.optional(v.number()),
    attempts: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("weekly_reports")
      .withIndex("by_workspace_week_key", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("weekKey", args.weekKey),
      )
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
      workspaceId: args.workspaceId,
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
    workspaceId: v.id("workspaces"),
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
      .withIndex("by_workspace_week_key", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("weekKey", args.weekKey),
      )
      .unique();
    const decision = decideWeeklyReportStart(existing, {
      now,
      triggerSource: args.triggerSource,
      triggeredBy: args.triggeredBy,
      startDate: args.startDate,
      endDate: args.endDate,
    });

    if (existing) {
      if (decision.mode === "skip") {
        await ctx.db.patch(existing._id, decision.patch);

        return {
          reportId: existing._id,
          runGeneration: decision.runGeneration,
          status: decision.status,
          startedAt: decision.startedAt,
          attempts: decision.attempts,
        };
      }

      await ctx.db.patch(existing._id, decision.patch);

      return {
        reportId: existing._id,
        runGeneration: decision.runGeneration,
        status: decision.status,
        startedAt: decision.startedAt,
        attempts: decision.attempts,
      };
    }

    const reportId = await ctx.db.insert("weekly_reports", {
      workspaceId: args.workspaceId,
      weekKey: args.weekKey,
      ...decision.doc,
    });

    return {
      reportId,
      runGeneration: decision.runGeneration,
      status: decision.status,
      startedAt: decision.startedAt,
      attempts: decision.attempts,
    };
  },
});

export const triggerWeeklyReport = action({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: v.object({
    weekKey: v.string(),
    status: weeklyStatusValidator,
    skipped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const actorMembership = await ctx.runQuery(api.workspaces.myMembershipByWorkspace, {
      workspaceId: args.workspaceId,
    });
    if (
      !actorMembership ||
      !actorMembership.isActive ||
      (actorMembership.role !== "admin" && actorMembership.role !== "superadmin")
    ) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Role tidak diizinkan" });
    }
    const actor = await ctx.runQuery(api.users.me, {});
    if (!actor) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Login required" });
    }

    return await ctx.runAction(internal.reportsNode.runWeeklyReport, {
      triggerSource: "manual",
      triggeredBy: actor._id,
      workspaceId: args.workspaceId,
    });
  },
});
