import { v } from "convex/values";

import { buildLegacyAttendanceSourcePatch } from "./attendance";
import { internalMutation } from "./_generated/server";

export function shouldDeleteLegacyDeviceHeartbeat(row) {
  return !row.deviceId || row.deviceUserId !== undefined;
}

export function shouldDeleteLegacyQrToken(row) {
  return !row.deviceId || row.deviceUserId !== undefined;
}

export function buildLegacyScanEventPatch(normalizeId, row) {
  const patch = {};
  const normalizedDeviceId = row.deviceId
    ? (normalizeId("devices", row.deviceId) ?? undefined)
    : undefined;

  if (normalizedDeviceId !== row.deviceId) {
    patch.deviceId = normalizedDeviceId;
  }
  if (row.deviceUserId !== undefined) {
    patch.deviceUserId = undefined;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export const cleanupLegacyDeviceUserReferences = internalMutation({
  args: {},
  returns: v.object({
    attendancePatched: v.number(),
    scanEventsPatched: v.number(),
    qrTokensDeleted: v.number(),
    heartbeatsDeleted: v.number(),
  }),
  handler: async (ctx) => {
    let attendancePatched = 0;
    const attendanceRows = await ctx.db.query("attendance").collect();
    for (const row of attendanceRows) {
      const patch = buildLegacyAttendanceSourcePatch(
        (tableName, id) => ctx.db.normalizeId(tableName, id),
        row,
      );
      if (!patch) {
        continue;
      }

      await ctx.db.patch(row._id, patch);
      attendancePatched += 1;
    }

    let scanEventsPatched = 0;
    const scanEventRows = await ctx.db.query("scan_events").collect();
    for (const row of scanEventRows) {
      const patch = buildLegacyScanEventPatch(
        (tableName, id) => ctx.db.normalizeId(tableName, id),
        row,
      );
      if (!patch) {
        continue;
      }

      await ctx.db.patch(row._id, patch);
      scanEventsPatched += 1;
    }

    let qrTokensDeleted = 0;
    const qrTokenRows = await ctx.db.query("qr_tokens").collect();
    for (const row of qrTokenRows) {
      if (!shouldDeleteLegacyQrToken(row)) {
        continue;
      }

      await ctx.db.delete(row._id);
      qrTokensDeleted += 1;
    }

    let heartbeatsDeleted = 0;
    const heartbeatRows = await ctx.db.query("device_heartbeats").collect();
    for (const row of heartbeatRows) {
      if (!shouldDeleteLegacyDeviceHeartbeat(row)) {
        continue;
      }

      await ctx.db.delete(row._id);
      heartbeatsDeleted += 1;
    }

    return {
      attendancePatched,
      scanEventsPatched,
      qrTokensDeleted,
      heartbeatsDeleted,
    };
  },
});
