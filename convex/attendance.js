import { ConvexError, v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";

import { internal } from "./_generated/api";
import { mutation, query, internalQuery } from "./_generated/server";
import {
  buildDateKey,
  distanceMeters,
  getCurrentDbUser,
  ensureGlobalSettingsForMutation,
  ipAllowed,
  requireRole,
} from "./helpers";
import {
  filterAttendanceByEmployeeName,
  paginateFilteredAttendance,
  summarizeAttendanceRows,
} from "./attendanceList";
import { isDeviceHeartbeatFresh } from "./deviceHeartbeatPolicy";

const attendanceWithEmployeeValidator = v.object({
  _id: v.id("attendance"),
  _creationTime: v.number(),
  userId: v.id("users"),
  dateKey: v.string(),
  checkInAt: v.optional(v.number()),
  checkOutAt: v.optional(v.number()),
  sourceDeviceId: v.optional(v.id("users")),
  edited: v.boolean(),
  editedBy: v.optional(v.id("users")),
  editedAt: v.optional(v.number()),
  editReason: v.optional(v.string()),
  lastScanAt: v.optional(v.number()),
  checkInMeta: v.optional(
    v.object({
      ipAddress: v.optional(v.string()),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      accuracyMeters: v.optional(v.number()),
      scannedAt: v.number(),
      sourceDeviceId: v.id("users"),
    }),
  ),
  checkOutMeta: v.optional(
    v.object({
      ipAddress: v.optional(v.string()),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      accuracyMeters: v.optional(v.number()),
      scannedAt: v.number(),
      sourceDeviceId: v.id("users"),
    }),
  ),
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
  actorUserId: v.id("users"),
  actorName: v.string(),
  actorEmail: v.string(),
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
    createdAt: payload.scannedAt,
  });
}

function buildScanMeta(args, scannedAt, sourceDeviceId) {
  return {
    ipAddress: args.ipAddress,
    latitude: args.latitude,
    longitude: args.longitude,
    accuracyMeters: args.accuracyMeters,
    scannedAt,
    sourceDeviceId,
  };
}

function throwScanError(code, message) {
  throw new ConvexError({ code, message });
}

async function processScan(ctx, actor, args, runtime) {
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

  if (
    settings.geofenceEnabled &&
    settings.geofenceLat !== undefined &&
    settings.geofenceLng !== undefined
  ) {
    if (args.latitude === undefined || args.longitude === undefined) {
      throwScanError("GEOFENCE_COORD_REQUIRED", "Lokasi wajib diisi");
    }

    if (
      args.accuracyMeters !== undefined &&
      args.accuracyMeters > settings.minLocationAccuracyMeters
    ) {
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

  if (args.idempotencyKey) {
    const existingEvent = await ctx.db
      .query("scan_events")
      .withIndex("by_actor_and_idempotency", (q) =>
        q.eq("actorUserId", actor._id).eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();

    if (existingEvent && now - existingEvent.scannedAt <= 60_000) {
      if (existingEvent.resultStatus === "accepted" && existingEvent.attendanceStatus) {
        return {
          status: existingEvent.attendanceStatus,
          dateKey: existingEvent.dateKey,
          message: existingEvent.message ?? "Scan berhasil diproses sebelumnya",
          sourceDeviceId: existingEvent.deviceUserId,
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

  const tokenResult = await ctx.runMutation(internal.qrTokens.validateAndConsume, {
    token: args.token,
  });
  if (!tokenResult.valid || !tokenResult.deviceUserId) {
    const reasonCode = tokenResult.reason ?? "TOKEN_UNKNOWN";
    const reasonMessage =
      reasonCode === "TOKEN_EXPIRED"
        ? "Token sudah expired"
        : reasonCode === "TOKEN_REPLAY"
          ? "Token sudah pernah dipakai"
          : "Token tidak dikenal";
    throwScanError(reasonCode, reasonMessage);
  }
  const sourceDeviceId = tokenResult.deviceUserId;

  if (settings.enforceDeviceHeartbeat) {
    const heartbeat = await ctx.db
      .query("device_heartbeats")
      .withIndex("by_device_user_id", (q) =>
        q.eq("deviceUserId", sourceDeviceId),
      )
      .unique();

    if (!isDeviceHeartbeatFresh(heartbeat, now)) {
      throwScanError(
        "DEVICE_HEARTBEAT_STALE",
        "Perangkat QR offline atau heartbeat kedaluwarsa",
      );
    }
  }

  const existing = await ctx.db
    .query("attendance")
    .withIndex("by_user_and_date", (q) =>
      q.eq("userId", actor._id).eq("dateKey", dateKey),
    )
    .unique();

  const cooldownMs = settings.scanCooldownSeconds * 1000;
  if (existing?.lastScanAt && now - existing.lastScanAt < cooldownMs) {
    throwScanError("SPAM_DETECTED", "Scan terlalu cepat, coba lagi beberapa detik");
  }

  if (!existing) {
    await ctx.db.insert("attendance", {
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
  args: { dateKey: v.string() },
  returns: v.array(attendanceWithEmployeeValidator),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "superadmin"]);
    const rows = await ctx.db
      .query("attendance")
      .withIndex("by_date_and_user", (q) => q.eq("dateKey", args.dateKey))
      .collect();
    return await enrichRowsWithEmployeeName(ctx, rows);
  },
});

export const listByDatePaginated = query({
  args: {
    dateKey: v.string(),
    edited: v.optional(v.boolean()),
    employeeName: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedAttendanceResponseValidator,
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "superadmin"]);

    const attendanceQuery =
      args.edited === undefined
        ? ctx.db
            .query("attendance")
            .withIndex("by_date_and_user", (q) => q.eq("dateKey", args.dateKey))
        : ctx.db
            .query("attendance")
            .withIndex("by_date_and_edited", (q) =>
              q.eq("dateKey", args.dateKey).eq("edited", args.edited),
            );

    const hasEmployeeNameFilter = Boolean(args.employeeName?.trim().length);

    if (hasEmployeeNameFilter) {
      const rows = await attendanceQuery.order("desc").collect();
      const enrichedRows = await enrichRowsWithEmployeeName(ctx, rows);
      const filteredRows = filterAttendanceByEmployeeName(
        enrichedRows,
        args.employeeName,
      );

      return {
        rowsPage: paginateFilteredAttendance(filteredRows, args.paginationOpts),
        summary: summarizeAttendanceRows(filteredRows),
      };
    }

    const rowsPage = await attendanceQuery.order("desc").paginate({
      ...args.paginationOpts,
      maximumRowsRead: args.paginationOpts.maximumRowsRead ?? 2_000,
    });

    const summaryRows =
      args.edited === undefined
        ? await ctx.db
            .query("attendance")
            .withIndex("by_date_and_user", (q) => q.eq("dateKey", args.dateKey))
            .collect()
        : await ctx.db
            .query("attendance")
            .withIndex("by_date_and_edited", (q) =>
              q.eq("dateKey", args.dateKey).eq("edited", args.edited),
            )
            .collect();

    return {
      rowsPage: {
        ...rowsPage,
        page: await enrichRowsWithEmployeeName(ctx, rowsPage.page),
      },
      summary: summarizeAttendanceRows(summaryRows),
    };
  },
});

export const getSummaryByDate = query({
  args: { dateKey: v.string() },
  returns: attendanceSummaryValidator,
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "superadmin"]);

    const rows = await ctx.db
      .query("attendance")
      .withIndex("by_date_and_user", (q) => q.eq("dateKey", args.dateKey))
      .collect();

    return summarizeAttendanceRows(rows);
  },
});

export const listByDateRangeUnsafe = internalQuery({
  args: {
    startDateKey: v.string(),
    endDateKey: v.string(),
  },
  returns: v.array(attendanceWithEmployeeValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("attendance")
      .withIndex("by_date_and_user", (q) =>
        q.gte("dateKey", args.startDateKey).lte("dateKey", args.endDateKey),
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
    const actor = await getCurrentDbUser(ctx);
    const now = Date.now();
    const settings = await ensureGlobalSettingsForMutation(ctx);
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
        { settings, now, dateKey },
      );

      await writeScanEvent(ctx, {
        actorUserId: actor._id,
        deviceUserId: result.sourceDeviceId,
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
        deviceUserId: undefined,
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

      throw error;
    }
  },
});

export const listScanEventsByDate = query({
  args: {
    dateKey: v.string(),
    status: v.optional(v.union(v.literal("accepted"), v.literal("rejected"))),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    rows: v.array(scanEventValidator),
    summary: scanEventSummaryValidator,
  }),
  handler: async (ctx, args) => {
    await requireRole(ctx, ["admin", "superadmin"]);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 60), 1), 200);

    const baseRows = await ctx.db
      .query("scan_events")
      .withIndex("by_date_and_status", (q) => q.eq("dateKey", args.dateKey))
      .order("desc")
      .take(500);

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
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ["admin", "superadmin"]);
    const row = await ctx.db.get(args.attendanceId);

    if (!row) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Data absensi tidak ditemukan",
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
