import { ConvexError, v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { buildDateKey, getGlobalSettingsOrNull, requireWorkspaceRole } from "./helpers";
import { getMinutesInTimezone, paginateRows } from "./employeeDashboardKpi";

const notificationTypeValidator = v.union(
  v.literal("attendance_success"),
  v.literal("attendance_failure"),
  v.literal("attendance_reminder"),
  v.literal("workspace_announcement"),
);

const notificationSeverityValidator = v.union(
  v.literal("info"),
  v.literal("success"),
  v.literal("warning"),
  v.literal("critical"),
);

const notificationActionTypeValidator = v.union(
  v.literal("open_scan"),
  v.literal("open_history"),
  v.literal("open_history_day"),
  v.literal("none"),
);

const notificationActionPayloadValidator = v.optional(
  v.object({
    dateKey: v.optional(v.string()),
  }),
);

const notificationMetadataValidator = v.optional(
  v.object({
    attendanceStatus: v.optional(
      v.union(v.literal("check-in"), v.literal("check-out")),
    ),
    reasonCode: v.optional(v.string()),
  }),
);

const notificationItemValidator = v.object({
  notificationId: v.id("employee_notifications"),
  workspaceId: v.id("workspaces"),
  userId: v.id("users"),
  type: notificationTypeValidator,
  title: v.string(),
  description: v.string(),
  severity: notificationSeverityValidator,
  createdAt: v.number(),
  readAt: v.optional(v.number()),
  actionType: notificationActionTypeValidator,
  actionPayload: notificationActionPayloadValidator,
  sourceKey: v.string(),
  expiresAt: v.optional(v.number()),
  metadata: notificationMetadataValidator,
});

const notificationsListValidator = v.object({
  items: v.array(notificationItemValidator),
  pageInfo: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  unreadCount: v.number(),
});

const notificationMutationResultValidator = v.object({
  unreadCount: v.number(),
  readAt: v.number(),
});

export function buildWorkspaceScopedSourceKey(workspaceId, sourceKey) {
  return `${String(workspaceId)}:${sourceKey}`;
}

export function buildCheckoutReminderSourceKey(dateKey, userId) {
  return `attendance_reminder:checkout:${dateKey}:${String(userId)}`;
}

function isExpired(notification, now = Date.now()) {
  return notification.expiresAt !== undefined && notification.expiresAt <= now;
}

function serializeNotification(notification) {
  return {
    notificationId: notification._id,
    workspaceId: notification.workspaceId,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    description: notification.description,
    severity: notification.severity,
    createdAt: notification.createdAt,
    readAt: notification.readAt,
    actionType: notification.actionType,
    actionPayload: notification.actionPayload,
    sourceKey: notification.sourceKey,
    expiresAt: notification.expiresAt,
    metadata: notification.metadata,
  };
}

async function listActiveNotificationsForUser(ctx, workspaceId, userId) {
  const rows = await ctx.db
    .query("employee_notifications")
    .withIndex("by_user_workspace_created_at", (q) =>
      q.eq("userId", userId).eq("workspaceId", workspaceId),
    )
    .order("desc")
    .collect();

  const now = Date.now();
  return rows.filter((row) => !isExpired(row, now));
}

async function countUnreadNotifications(ctx, workspaceId, userId) {
  const rows = await listActiveNotificationsForUser(ctx, workspaceId, userId);
  return rows.filter((row) => row.readAt === undefined).length;
}

export async function createOrMergeNotification(ctx, payload) {
  const now = payload.createdAt ?? Date.now();
  const workspaceScopedSourceKey = buildWorkspaceScopedSourceKey(
    payload.workspaceId,
    payload.sourceKey,
  );
  const existing = await ctx.db
    .query("employee_notifications")
    .withIndex("by_workspace_scoped_source_key", (q) =>
      q.eq("workspaceScopedSourceKey", workspaceScopedSourceKey),
    )
    .unique();

  const nextValues = {
    workspaceId: payload.workspaceId,
    userId: payload.userId,
    type: payload.type,
    title: payload.title,
    description: payload.description,
    severity: payload.severity,
    createdAt: now,
    readAt: undefined,
    actionType: payload.actionType ?? "none",
    actionPayload: payload.actionPayload,
    sourceKey: payload.sourceKey,
    workspaceScopedSourceKey,
    expiresAt: payload.expiresAt,
    metadata: payload.metadata,
  };

  if (existing) {
    await ctx.db.patch(existing._id, nextValues);
    return {
      notificationId: existing._id,
      created: false,
    };
  }

  return {
    notificationId: await ctx.db.insert("employee_notifications", nextValues),
    created: true,
  };
}

export async function expireCheckoutReminderForDate(
  ctx,
  workspaceId,
  userId,
  dateKey,
  expiredAt = Date.now(),
) {
  const scopedSourceKey = buildWorkspaceScopedSourceKey(
    workspaceId,
    buildCheckoutReminderSourceKey(dateKey, userId),
  );
  const existing = await ctx.db
    .query("employee_notifications")
    .withIndex("by_workspace_scoped_source_key", (q) =>
      q.eq("workspaceScopedSourceKey", scopedSourceKey),
    )
    .unique();

  if (!existing || existing.expiresAt !== undefined) {
    return null;
  }

  await ctx.db.patch(existing._id, {
    expiresAt: expiredAt,
  });
  return existing._id;
}

export const listMine = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: notificationsListValidator,
  handler: async (ctx, args) => {
    const { user } = await requireWorkspaceRole(ctx, args.workspaceId, ["karyawan"]);
    const rows = await listActiveNotificationsForUser(ctx, args.workspaceId, user._id);
    const page = paginateRows(rows, {
      numItems: Math.min(Math.max(Math.trunc(args.limit ?? 20), 1), 50),
      cursor: args.cursor ?? null,
    });

    return {
      items: page.page.map(serializeNotification),
      pageInfo: {
        continueCursor: page.continueCursor,
        isDone: page.isDone,
      },
      unreadCount: rows.filter((row) => row.readAt === undefined).length,
    };
  },
});

export const markRead = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    notificationId: v.id("employee_notifications"),
  },
  returns: notificationMutationResultValidator,
  handler: async (ctx, args) => {
    const { user } = await requireWorkspaceRole(ctx, args.workspaceId, ["karyawan"]);
    const notification = await ctx.db.get(args.notificationId);

    if (!notification) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Notifikasi tidak ditemukan.",
      });
    }

    if (
      notification.workspaceId !== args.workspaceId ||
      notification.userId !== user._id
    ) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Notifikasi ini bukan milik Anda.",
      });
    }

    const readAt = notification.readAt ?? Date.now();
    if (notification.readAt === undefined) {
      await ctx.db.patch(notification._id, { readAt });
    }

    return {
      unreadCount: await countUnreadNotifications(ctx, args.workspaceId, user._id),
      readAt,
    };
  },
});

export const markAllRead = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    beforeTs: v.optional(v.number()),
  },
  returns: notificationMutationResultValidator,
  handler: async (ctx, args) => {
    const { user } = await requireWorkspaceRole(ctx, args.workspaceId, ["karyawan"]);
    const readAt = Date.now();
    const rows = await listActiveNotificationsForUser(ctx, args.workspaceId, user._id);

    await Promise.all(
      rows
        .filter(
          (row) =>
            row.readAt === undefined &&
            (args.beforeTs === undefined || row.createdAt <= args.beforeTs),
        )
        .map((row) => ctx.db.patch(row._id, { readAt })),
    );

    return {
      unreadCount: await countUnreadNotifications(ctx, args.workspaceId, user._id),
      readAt,
    };
  },
});

export const runCheckoutReminders = internalMutation({
  args: {},
  returns: v.object({
    workspacesScanned: v.number(),
    remindersCreated: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const workspaces = await ctx.db.query("workspaces").collect();
    let remindersCreated = 0;
    let workspacesScanned = 0;

    for (const workspace of workspaces) {
      if (!workspace.isActive) {
        continue;
      }

      workspacesScanned += 1;

      const settings = await getGlobalSettingsOrNull(ctx, workspace._id);
      const timezone = settings?.timezone ?? "Asia/Jakarta";
      const localMinutes = getMinutesInTimezone(now, timezone);
      if (localMinutes < 16 * 60 + 30) {
        continue;
      }

      const dateKey = buildDateKey(now, timezone);
      const attendanceRows = await ctx.db
        .query("attendance")
        .withIndex("by_workspace_and_date_user", (q) =>
          q.eq("workspaceId", workspace._id).eq("dateKey", dateKey),
        )
        .collect();
      const attendanceByUserId = new Map(
        attendanceRows.map((row) => [String(row.userId), row]),
      );
      const members = await ctx.db
        .query("workspace_members")
        .withIndex("by_workspace_role_active", (q) =>
          q.eq("workspaceId", workspace._id).eq("role", "karyawan").eq("isActive", true),
        )
        .collect();

      for (const member of members) {
        const attendance = attendanceByUserId.get(String(member.userId));
        if (!attendance?.checkInAt || attendance.checkOutAt !== undefined) {
          continue;
        }

        const reminderResult = await createOrMergeNotification(ctx, {
          workspaceId: workspace._id,
          userId: member.userId,
          type: "attendance_reminder",
          title: "Jangan lupa scan pulang",
          description:
            "Hari ini Anda sudah check-in, tetapi check-out belum tercatat. Buka halaman scan untuk menyelesaikannya.",
          severity: "warning",
          actionType: "open_scan",
          actionPayload: {
            dateKey,
          },
          sourceKey: buildCheckoutReminderSourceKey(dateKey, member.userId),
          metadata: {
            reasonCode: "CHECKOUT_PENDING",
          },
          createdAt: now,
        });
        if (reminderResult.created) {
          remindersCreated += 1;
        }
      }
    }

    return {
      workspacesScanned,
      remindersCreated,
    };
  },
});
