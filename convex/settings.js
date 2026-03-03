import { v } from "convex/values";

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import {
  ensureGlobalSettingsForMutation,
  getGlobalSettingsOrThrow,
  requireRole,
} from "./helpers";

const settingsValidator = v.object({
  key: v.literal("global"),
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
  updatedBy: v.optional(v.id("users")),
  updatedAt: v.number(),
  _id: v.id("settings"),
  _creationTime: v.number(),
});

export const ensureGlobal = mutation({
  args: {},
  returns: settingsValidator,
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "superadmin"]);
    return await ensureGlobalSettingsForMutation(ctx);
  },
});

export const ensureGlobalInternal = internalMutation({
  args: {},
  returns: settingsValidator,
  handler: async (ctx) => {
    return await ensureGlobalSettingsForMutation(ctx);
  },
});

export const get = query({
  args: {},
  returns: settingsValidator,
  handler: async (ctx) => {
    await requireRole(ctx, ["admin", "superadmin"]);
    return await getGlobalSettingsOrThrow(ctx);
  },
});

export const getGlobalUnsafe = internalQuery({
  args: {},
  returns: settingsValidator,
  handler: async (ctx) => {
    return await getGlobalSettingsOrThrow(ctx);
  },
});

export const update = mutation({
  args: {
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
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireRole(ctx, ["superadmin"]);
    const current = await ensureGlobalSettingsForMutation(ctx);

    await ctx.db.patch(current._id, {
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
      updatedBy: actor._id,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("audit_logs", {
      actorUserId: actor._id,
      action: "settings.updated",
      targetType: "settings",
      targetId: String(current._id),
      payload: args,
      createdAt: Date.now(),
    });

    return null;
  },
});
