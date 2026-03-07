import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireWorkspaceRole } from "./helpers";

export const ping = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    deviceId: v.id("devices"),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    lastSeenAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.workspaceId !== args.workspaceId || device.status !== "active") {
      throw new Error("forbidden");
    }

    const now = Date.now();

    const existing = await ctx.db
      .query("device_heartbeats")
      .withIndex("by_workspace_device_id", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("deviceId", device._id),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeenAt: now,
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("device_heartbeats", {
        workspaceId: args.workspaceId,
        deviceId: device._id,
        lastSeenAt: now,
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
        updatedAt: now,
      });
    }

    await ctx.db.patch(device._id, {
      lastSeenAt: now,
      updatedAt: now,
    });

    return { ok: true, lastSeenAt: now };
  },
});

const heartbeatItemValidator = v.object({
  deviceId: v.id("devices"),
  label: v.string(),
  status: v.union(v.literal("active"), v.literal("revoked")),
  lastSeenAt: v.optional(v.number()),
  online: v.boolean(),
});

export const listStatus = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: v.array(heartbeatItemValidator),
  handler: async (ctx, args) => {
    await requireWorkspaceRole(ctx, args.workspaceId, ["admin", "superadmin"]);
    const now = Date.now();
    const onlineThreshold = now - 60_000;
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_workspace_status", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const rows = await Promise.all(
      devices.map(async (device) => {
        const beat = await ctx.db
          .query("device_heartbeats")
          .withIndex("by_workspace_device_id", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("deviceId", device._id),
          )
          .unique();

        return {
          deviceId: device._id,
          label: device.label,
          status: device.status,
          lastSeenAt: beat?.lastSeenAt,
          online:
            device.status === "active"
              ? (beat?.lastSeenAt ?? 0) >= onlineThreshold
              : false,
        };
      }),
    );

    rows.sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
    return rows;
  },
});
