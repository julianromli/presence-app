import { ConvexError, v } from 'convex/values';

import { mutation, query, internalQuery } from './_generated/server';
import {
  buildDateKey,
  distanceMeters,
  getCurrentDbUser,
  getGlobalSettings,
  ipAllowed,
  requireRole,
} from './helpers';

const attendanceWithEmployeeValidator = v.object({
  _id: v.id('attendance'),
  _creationTime: v.number(),
  userId: v.id('users'),
  dateKey: v.string(),
  checkInAt: v.optional(v.number()),
  checkOutAt: v.optional(v.number()),
  sourceDeviceId: v.optional(v.id('users')),
  edited: v.boolean(),
  editedBy: v.optional(v.id('users')),
  editedAt: v.optional(v.number()),
  editReason: v.optional(v.string()),
  lastScanAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  employeeName: v.string(),
});

async function enrichRowsWithEmployeeName(ctx, rows) {
  const userIds = [...new Set(rows.map((row) => String(row.userId)))];
  const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
  const userById = new Map(userIds.map((id, index) => [id, users[index]]));

  return rows.map((row) => ({
    ...row,
    employeeName: userById.get(String(row.userId))?.name ?? 'Unknown',
  }));
}

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function validateAndConsumeToken(ctx, token) {
  const tokenHash = await sha256Hex(token);
  const tokenRow = await ctx.db
    .query('qr_tokens')
    .withIndex('by_token_hash', (q) => q.eq('tokenHash', tokenHash))
    .unique();

  if (!tokenRow) {
    throw new ConvexError({ code: 'TOKEN_UNKNOWN', message: 'Token tidak dikenal' });
  }

  const now = Date.now();
  if (tokenRow.expiresAt < now) {
    throw new ConvexError({ code: 'TOKEN_EXPIRED', message: 'Token sudah expired' });
  }

  if (tokenRow.usedAt) {
    throw new ConvexError({ code: 'TOKEN_REPLAY', message: 'Token sudah pernah dipakai' });
  }

  await ctx.db.patch(tokenRow._id, { usedAt: now });
  return tokenRow.deviceUserId;
}

async function processScan(ctx, actor, args) {
  if (actor.role !== 'karyawan') {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Only karyawan can scan' });
  }

  const now = Date.now();
  const settings = await getGlobalSettings(ctx);
  const sourceDeviceId = await validateAndConsumeToken(ctx, args.token);

  if (settings.whitelistEnabled && !ipAllowed(args.ipAddress, settings.whitelistIps)) {
    throw new ConvexError({ code: 'IP_NOT_ALLOWED', message: 'IP address tidak diizinkan' });
  }

  if (
    settings.geofenceEnabled &&
    settings.geofenceLat !== undefined &&
    settings.geofenceLng !== undefined
  ) {
    if (args.latitude === undefined || args.longitude === undefined) {
      throw new ConvexError({ code: 'GEOFENCE_COORD_REQUIRED', message: 'Lokasi wajib diisi' });
    }

    const meters = distanceMeters(
      settings.geofenceLat,
      settings.geofenceLng,
      args.latitude,
      args.longitude,
    );

    if (meters > settings.geofenceRadiusMeters) {
      throw new ConvexError({
        code: 'GEOFENCE_OUTSIDE_RADIUS',
        message: 'Lokasi di luar radius kantor',
      });
    }
  }

  const dateKey = buildDateKey(now, settings.timezone);
  const existing = await ctx.db
    .query('attendance')
    .withIndex('by_user_and_date', (q) => q.eq('userId', actor._id).eq('dateKey', dateKey))
    .unique();

  if (existing?.lastScanAt && now - existing.lastScanAt < 30_000) {
    throw new ConvexError({
      code: 'SPAM_DETECTED',
      message: 'Scan terlalu cepat, coba lagi beberapa detik',
    });
  }

  if (!existing) {
    await ctx.db.insert('attendance', {
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
      createdAt: now,
      updatedAt: now,
    });

    return {
      status: 'check-in',
      dateKey,
      message: 'Check-in berhasil',
    };
  }

  if (existing.checkOutAt !== undefined) {
    return {
      status: 'check-out',
      dateKey,
      message: 'Check-out sudah tercatat',
    };
  }

  await ctx.db.patch(existing._id, {
    checkOutAt: now,
    sourceDeviceId,
    lastScanAt: now,
    updatedAt: now,
  });

  return {
    status: 'check-out',
    dateKey,
    message: 'Check-out berhasil',
  };
}

export const listByDate = query({
  args: { dateKey: v.string() },
  returns: v.array(attendanceWithEmployeeValidator),
  handler: async (ctx, args) => {
    await requireRole(ctx, ['admin', 'superadmin']);
    const rows = await ctx.db
      .query('attendance')
      .withIndex('by_date_and_user', (q) => q.eq('dateKey', args.dateKey))
      .collect();
    return await enrichRowsWithEmployeeName(ctx, rows);
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
      .query('attendance')
      .withIndex('by_date_and_user', (q) =>
        q.gte('dateKey', args.startDateKey).lte('dateKey', args.endDateKey),
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
  },
  returns: v.object({
    status: v.union(v.literal('check-in'), v.literal('check-out')),
    dateKey: v.string(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const actor = await getCurrentDbUser(ctx);
    return await processScan(ctx, actor, args);
  },
});

export const editAttendance = mutation({
  args: {
    attendanceId: v.id('attendance'),
    checkInAt: v.optional(v.number()),
    checkOutAt: v.optional(v.number()),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ['admin', 'superadmin']);
    const row = await ctx.db.get(args.attendanceId);

    if (!row) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Data absensi tidak ditemukan' });
    }

    await ctx.db.patch(args.attendanceId, {
      checkInAt: args.checkInAt ?? row.checkInAt,
      checkOutAt: args.checkOutAt ?? row.checkOutAt,
      edited: true,
      editedBy: actor._id,
      editedAt: Date.now(),
      editReason: args.reason,
      updatedAt: Date.now(),
    });

    await ctx.db.insert('audit_logs', {
      actorUserId: actor._id,
      action: 'attendance.edited',
      targetType: 'attendance',
      targetId: String(args.attendanceId),
      payload: {
        checkInAt: args.checkInAt,
        checkOutAt: args.checkOutAt,
        reason: args.reason,
      },
      createdAt: Date.now(),
    });

    return null;
  },
});
