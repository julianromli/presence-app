import { v } from "convex/values";

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import {
  assertValidGeofenceSettings,
  defaultAttendanceSchedule,
  ensureGlobalSettingsForMutation,
  getGlobalSettingsOrThrow,
  normalizeAttendanceSchedule,
  requireWorkspaceRole,
} from "./helpers";

const attendanceScheduleDayValidator = v.union(
  v.literal("monday"),
  v.literal("tuesday"),
  v.literal("wednesday"),
  v.literal("thursday"),
  v.literal("friday"),
  v.literal("saturday"),
  v.literal("sunday"),
);

const attendanceScheduleRowValidator = v.object({
  day: attendanceScheduleDayValidator,
  enabled: v.boolean(),
  checkInTime: v.optional(v.string()),
});

const settingsValidator = v.object({
  key: v.literal("global"),
  workspaceId: v.optional(v.id("workspaces")),
  timezone: v.string(),
  geofenceEnabled: v.boolean(),
  geofenceRadiusMeters: v.number(),
  scanCooldownSeconds: v.optional(v.number()),
  minLocationAccuracyMeters: v.optional(v.number()),
  enforceDeviceHeartbeat: v.optional(v.boolean()),
  geofenceLat: v.optional(v.number()),
  geofenceLng: v.optional(v.number()),
  whitelistEnabled: v.boolean(),
  whitelistIps: v.array(v.string()),
  attendanceSchedule: v.array(attendanceScheduleRowValidator),
  updatedBy: v.optional(v.id("users")),
  updatedAt: v.number(),
  _id: v.id("settings"),
  _creationTime: v.number(),
});

export const ensureGlobal = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: settingsValidator,
  handler: async (ctx, args) => {
    await requireWorkspaceRole(ctx, args.workspaceId, ["admin", "superadmin"]);
    return await ensureGlobalSettingsForMutation(ctx, args.workspaceId);
  },
});

export const ensureGlobalInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: settingsValidator,
  handler: async (ctx, args) => {
    return await ensureGlobalSettingsForMutation(ctx, args.workspaceId);
  },
});

export const get = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: settingsValidator,
  handler: async (ctx, args) => {
    await requireWorkspaceRole(ctx, args.workspaceId, ["admin", "superadmin"]);
    return await getGlobalSettingsOrThrow(ctx, args.workspaceId);
  },
});

export const getGlobalUnsafe = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: settingsValidator,
  handler: async (ctx, args) => {
    return await getGlobalSettingsOrThrow(ctx, args.workspaceId);
  },
});

export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    timezone: v.optional(v.string()),
    geofenceEnabled: v.optional(v.boolean()),
    geofenceRadiusMeters: v.optional(v.number()),
    scanCooldownSeconds: v.optional(v.number()),
    minLocationAccuracyMeters: v.optional(v.number()),
    enforceDeviceHeartbeat: v.optional(v.boolean()),
    geofenceLat: v.optional(v.number()),
    geofenceLng: v.optional(v.number()),
    whitelistEnabled: v.optional(v.boolean()),
    whitelistIps: v.optional(v.array(v.string())),
    attendanceSchedule: v.optional(v.array(attendanceScheduleRowValidator)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user: actor } = await requireWorkspaceRole(ctx, args.workspaceId, [
      "superadmin",
    ]);
    const current = await ensureGlobalSettingsForMutation(ctx, args.workspaceId);
    const attendanceSchedule =
      args.attendanceSchedule !== undefined
        ? normalizeAttendanceSchedule(args.attendanceSchedule)
        : current.attendanceSchedule ?? defaultAttendanceSchedule();
    const nextSettings = {
      timezone: args.timezone ?? current.timezone,
      geofenceEnabled: args.geofenceEnabled ?? current.geofenceEnabled,
      geofenceRadiusMeters:
        args.geofenceRadiusMeters ?? current.geofenceRadiusMeters,
      scanCooldownSeconds:
        args.scanCooldownSeconds ?? current.scanCooldownSeconds,
      minLocationAccuracyMeters:
        args.minLocationAccuracyMeters ?? current.minLocationAccuracyMeters,
      enforceDeviceHeartbeat:
        args.enforceDeviceHeartbeat ?? current.enforceDeviceHeartbeat,
      geofenceLat: args.geofenceLat ?? current.geofenceLat,
      geofenceLng: args.geofenceLng ?? current.geofenceLng,
      whitelistEnabled: args.whitelistEnabled ?? current.whitelistEnabled,
      whitelistIps: args.whitelistIps ?? current.whitelistIps,
      attendanceSchedule,
    };

    assertValidGeofenceSettings(nextSettings);

    await ctx.db.patch(current._id, {
      ...nextSettings,
      updatedBy: actor._id,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("audit_logs", {
      actorUserId: actor._id,
      action: "settings.updated",
      targetType: "settings",
      targetId: String(current._id),
      payload: args,
      workspaceId: current.workspaceId,
      createdAt: Date.now(),
    });

    return null;
  },
});
