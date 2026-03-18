import { ConvexError, v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";

import { internalMutation, mutation, query, internalQuery } from "./_generated/server";
import {
  buildDateKey,
  distanceMeters,
  ensureGlobalSettingsForMutation,
  getGlobalSettingsOrThrow,
  hasValidGeofenceConfiguration,
  ipAllowed,
  requireWorkspaceRole,
  sha256Hex,
} from "./helpers";
import {
  filterAttendanceByEmployeeName,
  filterAttendanceByStatus,
  paginateFilteredAttendance,
  summarizeAttendanceRows,
} from "./attendanceList";
import { isDeviceHeartbeatFresh } from "./deviceHeartbeatPolicy";
import {
  createOrMergeNotification,
  expireCheckoutReminderForDate,
} from "./notifications";

const legacyCompatibleSourceDeviceIdValidator = v.union(
  v.id("devices"),
  v.id("users"),
);
const optionalLegacyCompatibleSourceDeviceIdValidator = v.optional(
  legacyCompatibleSourceDeviceIdValidator,
);
const scanMetaValidator = v.object({
  ipAddress: v.optional(v.string()),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  accuracyMeters: v.optional(v.number()),
  scannedAt: v.number(),
  sourceDeviceId: optionalLegacyCompatibleSourceDeviceIdValidator,
});

const attendanceWithEmployeeValidator = v.object({
  _id: v.id("attendance"),
  _creationTime: v.number(),
  workspaceId: v.id("workspaces"),
  userId: v.id("users"),
  dateKey: v.string(),
  checkInAt: v.optional(v.number()),
  checkOutAt: v.optional(v.number()),
  sourceDeviceId: optionalLegacyCompatibleSourceDeviceIdValidator,
  edited: v.boolean(),
  editedBy: v.optional(v.id("users")),
  editedAt: v.optional(v.number()),
  editReason: v.optional(v.string()),
  lastScanAt: v.optional(v.number()),
  checkInMeta: v.optional(scanMetaValidator),
  checkOutMeta: v.optional(scanMetaValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
  employeeName: v.string(),
});
const attendanceSummaryValidator = v.object({
  total: v.number(),
  checkedIn: v.number(),
  checkedOut: v.number(),
  edited: v.number(),
});
const scanEventValidator = v.object({
  _id: v.id("scan_events"),
  _creationTime: v.number(),
  workspaceId: v.id("workspaces"),
  actorUserId: v.id("users"),
  actorName: v.string(),
  actorEmail: v.string(),
  deviceId: v.optional(v.id("devices")),
  deviceUserId: v.optional(v.id("users")),
  dateKey: v.string(),
  resultStatus: v.union(v.literal("accepted"), v.literal("rejected")),
  reasonCode: v.string(),
  attendanceStatus: v.optional(
    v.union(v.literal("check-in"), v.literal("check-out")),
  ),
  message: v.optional(v.string()),
  ipAddress: v.optional(v.string()),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  accuracyMeters: v.optional(v.number()),
  idempotencyKey: v.string(),
  scannedAt: v.number(),
  createdAt: v.number(),
});
const scanEventSummaryValidator = v.object({
  total: v.number(),
  accepted: v.number(),
  rejected: v.number(),
  byReason: v.array(
    v.object({
      reasonCode: v.string(),
      count: v.number(),
    }),
  ),
});
const paginatedAttendanceValidator = paginationResultValidator(
  attendanceWithEmployeeValidator,
);
const paginatedAttendanceResponseValidator = v.object({
  rowsPage: paginatedAttendanceValidator,
  summary: attendanceSummaryValidator,
  timezone: v.string(),
});

async function enrichRowsWithEmployeeName(ctx, rows) {
  const userIds = [...new Set(rows.map((row) => String(row.userId)))];
  const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
  const userById = new Map(userIds.map((id, index) => [id, users[index]]));

  return rows.map((row) => ({
    ...row,
    employeeName: userById.get(String(row.userId))?.name ?? "Unknown",
  }));
}

async function writeScanEvent(ctx, payload) {
  await ctx.db.insert("scan_events", {
    ...payload,
    workspaceId: payload.workspaceId,
    createdAt: payload.scannedAt,
  });
}

export function buildScanMeta(args, scannedAt, sourceDeviceId) {
  return {
    ipAddress: args.ipAddress,
    latitude: args.latitude,
    longitude: args.longitude,
    accuracyMeters: args.accuracyMeters,
    scannedAt,
    sourceDeviceId,
  };
}

export function normalizeLegacySourceDeviceId(normalizeId, sourceDeviceId) {
  if (!sourceDeviceId) {
    return undefined;
  }

  return normalizeId("devices", sourceDeviceId) ?? undefined;
}

export function normalizeLegacyScanMeta(normalizeId, scanMeta) {
  if (!scanMeta) {
    return undefined;
  }

  const normalizedSourceDeviceId = normalizeLegacySourceDeviceId(
    normalizeId,
    scanMeta.sourceDeviceId,
  );

  if (normalizedSourceDeviceId === scanMeta.sourceDeviceId) {
    return scanMeta;
  }

  const normalizedScanMeta = { ...scanMeta };
  if (normalizedSourceDeviceId === undefined) {
    delete normalizedScanMeta.sourceDeviceId;
  } else {
    normalizedScanMeta.sourceDeviceId = normalizedSourceDeviceId;
  }
  return normalizedScanMeta;
}

export function buildLegacyAttendanceSourcePatch(normalizeId, attendanceRow) {
  const patch = {};
  const normalizedSourceDeviceId = normalizeLegacySourceDeviceId(
    normalizeId,
    attendanceRow.sourceDeviceId,
  );
  const normalizedCheckInMeta = normalizeLegacyScanMeta(
    normalizeId,
    attendanceRow.checkInMeta,
  );
  const normalizedCheckOutMeta = normalizeLegacyScanMeta(
    normalizeId,
    attendanceRow.checkOutMeta,
  );

  if (normalizedSourceDeviceId !== attendanceRow.sourceDeviceId) {
    patch.sourceDeviceId = normalizedSourceDeviceId;
  }
  if (normalizedCheckInMeta !== attendanceRow.checkInMeta) {
    patch.checkInMeta = normalizedCheckInMeta;
  }
  if (normalizedCheckOutMeta !== attendanceRow.checkOutMeta) {
    patch.checkOutMeta = normalizedCheckOutMeta;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function throwScanError(code, message) {
  throw new ConvexError({ code, message });
}

const actionableFailureNotificationCodes = new Set([
  "GEOFENCE_NOT_CONFIGURED",
  "GEOFENCE_COORD_REQUIRED",
  "GEOFENCE_ACCURACY_REQUIRED",
  "GEOFENCE_ACCURACY_TOO_LOW",
  "GEOFENCE_OUTSIDE_RADIUS",
  "IP_NOT_ALLOWED",
  "TOKEN_EXPIRED",
  "TOKEN_REPLAY",
  "TOKEN_UNKNOWN",
  "DEVICE_HEARTBEAT_STALE",
  "DEVICE_UNAUTHORIZED",
]);

function failureNotificationSeverity(code) {
  if (code === "DEVICE_HEARTBEAT_STALE" || code === "DEVICE_UNAUTHORIZED") {
    return "critical";
  }
  return "warning";
}

async function createAcceptedScanNotification(ctx, actor, workspaceId, result) {
  if (result.status === "check-out") {
    await expireCheckoutReminderForDate(
      ctx,
      workspaceId,
      actor._id,
      result.dateKey,
      result.scanAt,
    );
  }

  await createOrMergeNotification(ctx, {
    workspaceId,
    userId: actor._id,
    type: "attendance_success",
    title:
      result.status === "check-in"
        ? "Check-in berhasil"
        : "Check-out berhasil",
    description: result.message,
    severity: "success",
    actionType: "open_history_day",
    actionPayload: {
      dateKey: result.dateKey,
    },
    sourceKey: `attendance_success:${result.dateKey}:${result.status}:${String(actor._id)}`,
    metadata: {
      attendanceStatus: result.status,
      reasonCode: "OK",
    },
    createdAt: result.scanAt,
  });
}

async function createRejectedScanNotification(
  ctx,
  actor,
  workspaceId,
  { code, message, scannedAt },
) {
  if (!actionableFailureNotificationCodes.has(code)) {
    return;
  }

  const bucket = Math.floor(scannedAt / (5 * 60 * 1000));
  await createOrMergeNotification(ctx, {
    workspaceId,
    userId: actor._id,
    type: "attendance_failure",
    title: "Scan ditolak",
    description: message,
    severity: failureNotificationSeverity(code),
    actionType: "open_scan",
    sourceKey: `attendance_failure:${code}:${bucket}:${String(actor._id)}`,
    metadata: {
      reasonCode: code,
    },
    createdAt: scannedAt,
  });
}

export function assertScanSourceDeviceAllowed(
  device,
  { enforceDeviceHeartbeat, heartbeat },
  now = Date.now(),
) {
  if (!device || device.status !== "active") {
    throwScanError("DEVICE_UNAUTHORIZED", "Perangkat QR tidak valid.");
  }

  if (enforceDeviceHeartbeat && !isDeviceHeartbeatFresh(heartbeat, now)) {
    throwScanError(
      "DEVICE_HEARTBEAT_STALE",
      "Perangkat QR offline atau heartbeat kedaluwarsa",
    );
  }

  return device._id;
}

async function resolveValidScanToken(ctx, workspaceId, token) {
  const tokenHash = await sha256Hex(token);
  const tokenRow = await ctx.db
    .query("qr_tokens")
    .withIndex("by_workspace_token_hash", (q) =>
      q.eq("workspaceId", workspaceId).eq("tokenHash", tokenHash),
    )
    .unique();

  if (!tokenRow) {
    throwScanError("TOKEN_UNKNOWN", "Token tidak dikenal");
  }

  const now = Date.now();
  if (tokenRow.expiresAt < now) {
    throwScanError("TOKEN_EXPIRED", "Token sudah expired");
  }

  if (tokenRow.usedAt) {
    throwScanError("TOKEN_REPLAY", "Token sudah pernah dipakai");
  }

  return tokenRow;
}

async function markScanTokenUsed(ctx, tokenRowId, usedAt) {
  await ctx.db.patch(tokenRowId, { usedAt });
}

export function assertGeofenceScanAllowed(settings, args) {
  if (!settings.geofenceEnabled) {
    return;
  }

  if (!hasValidGeofenceConfiguration(settings)) {
    throwScanError(
      "GEOFENCE_NOT_CONFIGURED",
      "Geofence kantor belum dikonfigurasi dengan benar. Hubungi admin.",
    );
  }

  if (args.latitude === undefined || args.longitude === undefined) {
    throwScanError("GEOFENCE_COORD_REQUIRED", "Lokasi wajib diisi");
  }

  if (
    args.accuracyMeters === undefined ||
    !Number.isFinite(args.accuracyMeters) ||
    args.accuracyMeters < 0
  ) {
    throwScanError(
      "GEOFENCE_ACCURACY_REQUIRED",
      "Akurasi GPS wajib tersedia untuk scan di area kantor.",
    );
  }

  if (args.accuracyMeters > settings.minLocationAccuracyMeters) {
    throwScanError(
      "GEOFENCE_ACCURACY_TOO_LOW",
      "Akurasi GPS tidak mencukupi",
    );
  }

  const meters = distanceMeters(
    settings.geofenceLat,
    settings.geofenceLng,
    args.latitude,
    args.longitude,
  );

  if (meters > settings.geofenceRadiusMeters) {
    throwScanError("GEOFENCE_OUTSIDE_RADIUS", "Lokasi di luar radius kantor");
  }
}

export async function processScan(ctx, actor, args, runtime) {
  if (actor.role !== "karyawan") {
    throwScanError("FORBIDDEN", "Only karyawan can scan");
  }

  const { settings, now, dateKey } = runtime;

  if (
    settings.whitelistEnabled &&
    !ipAllowed(args.ipAddress, settings.whitelistIps)
  ) {
    throwScanError("IP_NOT_ALLOWED", "IP address tidak diizinkan");
  }

  if (args.idempotencyKey) {
    const existingEvent = await ctx.db
      .query("scan_events")
      .withIndex("by_actor_and_idempotency", (q) =>
        q.eq("actorUserId", actor._id).eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();

    if (
      existingEvent &&
      now - existingEvent.scannedAt <= 60_000 &&
      existingEvent.workspaceId === runtime.workspaceId
    ) {
      if (existingEvent.resultStatus === "accepted" && existingEvent.attendanceStatus) {
        return {
          status: existingEvent.attendanceStatus,
          dateKey: existingEvent.dateKey,
          message: existingEvent.message ?? "Scan berhasil diproses sebelumnya",
          sourceDeviceId: existingEvent.deviceId,
          scanAt: existingEvent.scannedAt,
          cooldownSeconds: settings.scanCooldownSeconds,
        };
      }

      throwScanError(
        existingEvent.reasonCode || "SCAN_REJECTED",
        existingEvent.message ?? "Scan ditolak",
      );
    }
  }

  const tokenRow = await resolveValidScanToken(ctx, runtime.workspaceId, args.token);
  const sourceDevice = await ctx.db.get(tokenRow.deviceId);
  const heartbeat = await ctx.db
    .query("device_heartbeats")
    .withIndex("by_workspace_device_id", (q) =>
      q.eq("workspaceId", runtime.workspaceId).eq("deviceId", tokenRow.deviceId),
    )
    .unique();
  const sourceDeviceId = assertScanSourceDeviceAllowed(
    sourceDevice,
    {
      enforceDeviceHeartbeat: Boolean(settings.enforceDeviceHeartbeat),
      heartbeat,
    },
    now,
  );
  const existing = await ctx.db
    .query("attendance")
    .withIndex("by_workspace_user_date", (q) =>
      q
        .eq("workspaceId", runtime.workspaceId)
        .eq("userId", actor._id)
        .eq("dateKey", dateKey),
    )
    .unique();

  const cooldownMs = settings.scanCooldownSeconds * 1000;
  if (existing?.lastScanAt && now - existing.lastScanAt < cooldownMs) {
    throwScanError("SPAM_DETECTED", "Scan terlalu cepat, coba lagi beberapa detik");
  }

  assertGeofenceScanAllowed(settings, args);

  if (!existing) {
    await markScanTokenUsed(ctx, tokenRow._id, now);
    await ctx.db.insert("attendance", {
      workspaceId: runtime.workspaceId,
      userId: actor._id,
      dateKey,
      checkInAt: now,
      checkOutAt: undefined,
      sourceDeviceId,
      edited: false,
      editedBy: undefined,
      editedAt: undefined,
      editReason: undefined,
      lastScanAt: now,
      checkInMeta: buildScanMeta(args, now, sourceDeviceId),
      checkOutMeta: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return {
      status: "check-in",
      dateKey,
      message: "Check-in berhasil",
      sourceDeviceId,
      scanAt: now,
      cooldownSeconds: settings.scanCooldownSeconds,
    };
  }

  if (existing.checkOutAt !== undefined) {
    throwScanError("CHECKOUT_ALREADY_RECORDED", "Check-out sudah tercatat");
  }

  await markScanTokenUsed(ctx, tokenRow._id, now);
  await ctx.db.patch(existing._id, {
    checkOutAt: now,
    sourceDeviceId,
    lastScanAt: now,
    checkOutMeta: buildScanMeta(args, now, sourceDeviceId),
    updatedAt: now,
  });

  return {
    status: "check-out",
    dateKey,
    message: "Check-out berhasil",
    sourceDeviceId,
    scanAt: now,
    cooldownSeconds: settings.scanCooldownSeconds,
  };
}

export const listByDate = query({
  args: {
    dateKey: v.string(),
    workspaceId: v.id("workspaces"),
  },
  returns: v.array(attendanceWithEmployeeValidator),
  handler: async (ctx, args) => {
    await requireWorkspaceRole(ctx, args.workspaceId, ["admin", "superadmin"]);
    const rows = await ctx.db
      .query("attendance")
      .withIndex("by_workspace_and_date_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("dateKey", args.dateKey),
      )
      .collect();
    return await enrichRowsWithEmployeeName(ctx, rows);
  },
});

export const listByDatePaginated = query({
  args: {
    dateKey: v.string(),
    workspaceId: v.id("workspaces"),
    edited: v.optional(v.boolean()),
    employeeName: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("not-checked-in"),
        v.literal("checked-in"),
        v.literal("incomplete"),
        v.literal("completed"),
      ),
    ),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedAttendanceResponseValidator,
  handler: async (ctx, args) => {
    await requireWorkspaceRole(ctx, args.workspaceId, ["admin", "superadmin"]);
    const settings = await getGlobalSettingsOrThrow(ctx, args.workspaceId);

    const attendanceQuery =
      args.edited === undefined
        ? ctx.db
            .query("attendance")
            .withIndex("by_workspace_and_date_user", (q) =>
              q.eq("workspaceId", args.workspaceId).eq("dateKey", args.dateKey),
            )
        : (
            await ctx.db
              .query("attendance")
              .withIndex("by_workspace_and_date_user", (q) =>
                q.eq("workspaceId", args.workspaceId).eq("dateKey", args.dateKey),
              )
              .collect()
          ).filter((row) => row.edited === args.edited);

    const hasEmployeeNameFilter = Boolean(args.employeeName?.trim().length);
    const hasStatusFilter = Boolean(args.status);

    if (hasEmployeeNameFilter || args.edited !== undefined || hasStatusFilter) {
      const rows =
        args.edited === undefined
          ? await attendanceQuery.order("desc").collect()
          : attendanceQuery;
      const enrichedRows = await enrichRowsWithEmployeeName(ctx, rows);
      const filteredRows = filterAttendanceByStatus(
        filterAttendanceByEmployeeName(enrichedRows, args.employeeName),
        args.status,
      );

      return {
        rowsPage: paginateFilteredAttendance(filteredRows, args.paginationOpts),
        summary: summarizeAttendanceRows(filteredRows),
        timezone: settings.timezone,
      };
    }

    const rowsPage = await attendanceQuery.order("desc").paginate({
      ...args.paginationOpts,
      maximumRowsRead: args.paginationOpts.maximumRowsRead ?? 2_000,
    });

    const summaryRows = await ctx.db
      .query("attendance")
      .withIndex("by_workspace_and_date_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("dateKey", args.dateKey),
      )
      .collect();

    return {
      rowsPage: {
        ...rowsPage,
        page: await enrichRowsWithEmployeeName(ctx, rowsPage.page),
      },
      summary: summarizeAttendanceRows(summaryRows),
      timezone: settings.timezone,
    };
  },
});

export const getSummaryByDate = query({
  args: {
    dateKey: v.string(),
    workspaceId: v.id("workspaces"),
  },
  returns: attendanceSummaryValidator,
  handler: async (ctx, args) => {
    await requireWorkspaceRole(ctx, args.workspaceId, ["admin", "superadmin"]);

    const rows = await ctx.db
      .query("attendance")
      .withIndex("by_workspace_and_date_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("dateKey", args.dateKey),
      )
      .collect();

    return summarizeAttendanceRows(rows);
  },
});

export const listByDateRangeUnsafe = internalQuery({
  args: {
    startDateKey: v.string(),
    endDateKey: v.string(),
    workspaceId: v.id("workspaces"),
  },
  returns: v.array(attendanceWithEmployeeValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("attendance")
      .withIndex("by_workspace_and_date_user", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .gte("dateKey", args.startDateKey)
          .lte("dateKey", args.endDateKey),
      )
      .collect();
    return await enrichRowsWithEmployeeName(ctx, rows);
  },
});

export const recordScan = mutation({
  args: {
    token: v.string(),
    ipAddress: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    accuracyMeters: v.optional(v.number()),
    idempotencyKey: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
  },
  returns: v.object({
    status: v.union(v.literal("check-in"), v.literal("check-out")),
    dateKey: v.string(),
    message: v.string(),
    scanAt: v.number(),
    policy: v.object({
      cooldownSeconds: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const { user: actor } = await requireWorkspaceRole(ctx, args.workspaceId, [
      "karyawan",
    ]);
    const now = Date.now();
    const settings = await ensureGlobalSettingsForMutation(ctx, args.workspaceId);
    const dateKey = buildDateKey(now, settings.timezone);
    const idempotencyKey = args.idempotencyKey?.trim() || "";

    try {
      const result = await processScan(
        ctx,
        actor,
        {
          ...args,
          idempotencyKey,
        },
        { settings, now, dateKey, workspaceId: args.workspaceId },
      );

      await writeScanEvent(ctx, {
        actorUserId: actor._id,
        workspaceId: args.workspaceId,
        deviceId: result.sourceDeviceId,
        dateKey: result.dateKey,
        resultStatus: "accepted",
        reasonCode: "OK",
        attendanceStatus: result.status,
        message: result.message,
        ipAddress: args.ipAddress,
        latitude: args.latitude,
        longitude: args.longitude,
        accuracyMeters: args.accuracyMeters,
        idempotencyKey,
        scannedAt: result.scanAt,
      });

      try {
        await createAcceptedScanNotification(
          ctx,
          actor,
          args.workspaceId,
          result,
        );
      } catch (notificationError) {
        console.error("[attendance-notification-accepted]", notificationError);
      }

      return {
        status: result.status,
        dateKey: result.dateKey,
        message: result.message,
        scanAt: result.scanAt,
        policy: {
          cooldownSeconds: result.cooldownSeconds,
        },
      };
    } catch (error) {
      const code =
        error instanceof ConvexError && error.data?.code
          ? String(error.data.code)
          : "SCAN_FAILED";
      const message =
        error instanceof ConvexError && error.data?.message
          ? String(error.data.message)
          : "Scan gagal diproses";

      await writeScanEvent(ctx, {
        actorUserId: actor._id,
        workspaceId: args.workspaceId,
        deviceId: undefined,
        dateKey,
        resultStatus: "rejected",
        reasonCode: code,
        attendanceStatus: undefined,
        message,
        ipAddress: args.ipAddress,
        latitude: args.latitude,
        longitude: args.longitude,
        accuracyMeters: args.accuracyMeters,
        idempotencyKey,
        scannedAt: now,
      });

      try {
        await createRejectedScanNotification(ctx, actor, args.workspaceId, {
          code,
          message,
          scannedAt: now,
        });
      } catch (notificationError) {
        console.error("[attendance-notification-rejected]", notificationError);
      }

      throw error;
    }
  },
});

export const listScanEventsByDate = query({
  args: {
    dateKey: v.string(),
    workspaceId: v.id("workspaces"),
    status: v.optional(v.union(v.literal("accepted"), v.literal("rejected"))),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    rows: v.array(scanEventValidator),
    summary: scanEventSummaryValidator,
  }),
  handler: async (ctx, args) => {
    await requireWorkspaceRole(ctx, args.workspaceId, ["admin", "superadmin"]);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 60), 1), 200);

    const baseRows = await ctx.db
      .query("scan_events")
      .withIndex("by_workspace_date_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("dateKey", args.dateKey),
      )
      .order("desc")
      .collect();

    const filtered =
      args.status === undefined
        ? baseRows
        : baseRows.filter((row) => row.resultStatus === args.status);

    const actorIds = [...new Set(filtered.map((row) => String(row.actorUserId)))];
    const actorDocs = await Promise.all(actorIds.map((id) => ctx.db.get(id)));
    const actorMap = new Map(actorIds.map((id, idx) => [id, actorDocs[idx]]));

    const rows = filtered.slice(0, limit).map((row) => {
      const actor = actorMap.get(String(row.actorUserId));
      return {
        ...row,
        actorName: actor?.name ?? "Unknown",
        actorEmail: actor?.email ?? "unknown@local",
      };
    });

    const byReasonMap = new Map();
    for (const row of filtered) {
      byReasonMap.set(row.reasonCode, (byReasonMap.get(row.reasonCode) ?? 0) + 1);
    }

    const byReason = [...byReasonMap.entries()]
      .map(([reasonCode, count]) => ({ reasonCode, count }))
      .sort((a, b) => b.count - a.count);

    return {
      rows,
      summary: {
        total: filtered.length,
        accepted: filtered.filter((row) => row.resultStatus === "accepted").length,
        rejected: filtered.filter((row) => row.resultStatus === "rejected").length,
        byReason,
      },
    };
  },
});

export const editAttendance = mutation({
  args: {
    attendanceId: v.id("attendance"),
    checkInAt: v.optional(v.number()),
    checkOutAt: v.optional(v.number()),
    reason: v.string(),
    workspaceId: v.id("workspaces"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user: actor } = await requireWorkspaceRole(ctx, args.workspaceId, [
      "admin",
      "superadmin",
    ]);
    const row = await ctx.db.get(args.attendanceId);

    if (!row) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Data absensi tidak ditemukan",
      });
    }
    if (row.workspaceId !== args.workspaceId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Data absensi bukan milik workspace aktif.",
      });
    }

    const nextCheckInAt = args.checkInAt ?? row.checkInAt;
    const nextCheckOutAt = args.checkOutAt ?? row.checkOutAt;
    if (
      nextCheckInAt !== undefined &&
      nextCheckOutAt !== undefined &&
      nextCheckOutAt < nextCheckInAt
    ) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Jam pulang tidak boleh lebih awal dari jam datang.",
      });
    }

    const now = Date.now();

    await ctx.db.patch(args.attendanceId, {
      checkInAt: nextCheckInAt,
      checkOutAt: nextCheckOutAt,
      edited: true,
      editedBy: actor._id,
      editedAt: now,
      editReason: args.reason,
      updatedAt: now,
    });

    await ctx.db.insert("audit_logs", {
      actorUserId: actor._id,
      action: "attendance.edited",
      targetType: "attendance",
      targetId: String(args.attendanceId),
      workspaceId: row.workspaceId,
      payload: {
        before: {
          checkInAt: row.checkInAt,
          checkOutAt: row.checkOutAt,
        },
        after: {
          checkInAt: nextCheckInAt,
          checkOutAt: nextCheckOutAt,
        },
        reason: args.reason,
      },
      createdAt: now,
    });

    return null;
  },
});

export const cleanupLegacyAttendanceSourceDevices = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    scanned: v.number(),
    patched: v.number(),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("attendance").paginate({
      cursor: args.cursor ?? null,
      numItems: Math.min(Math.max(Math.trunc(args.limit ?? 200), 1), 500),
    });

    let patched = 0;
    for (const row of page.page) {
      const patch = buildLegacyAttendanceSourcePatch(
        (tableName, id) => ctx.db.normalizeId(tableName, id),
        row,
      );
      if (!patch) {
        continue;
      }

      await ctx.db.patch(row._id, patch);
      patched += 1;
    }

    return {
      scanned: page.page.length,
      patched,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});
