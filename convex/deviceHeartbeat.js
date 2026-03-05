import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireWorkspaceRole } from "./helpers";

export const ping = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    lastSeenAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const { user: actor } = await requireWorkspaceRole(ctx, args.workspaceId, [
      "device-qr",
    ]);
    const now = Date.now();

    const existing = await ctx.db
      .query("device_heartbeats")
      .withIndex("by_workspace_device_user_id", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("deviceUserId", actor._id),
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
        deviceUserId: actor._id,
        lastSeenAt: now,
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
        updatedAt: now,
      });
    }

    return { ok: true, lastSeenAt: now };
  },
});

const heartbeatItemValidator = v.object({
  deviceUserId: v.id("users"),
  name: v.string(),
  email: v.string(),
  isActive: v.boolean(),
  role: v.literal("device-qr"),
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
    const memberships = await ctx.db
      .query("workspace_members")
      .withIndex("by_workspace_role_active", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("role", "device-qr").eq("isActive", true),
      )
      .collect();
    const deviceIds = memberships.map((membership) => membership.userId);
    const devices = (await Promise.all(deviceIds.map((id) => ctx.db.get(id)))).filter(
      (user) => user !== null && user.isActive && user.role === "device-qr",
    );

    const rows = await Promise.all(
      devices.map(async (device) => {
        const beat = await ctx.db
          .query("device_heartbeats")
          .withIndex("by_workspace_device_user_id", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("deviceUserId", device._id),
          )
          .unique();

        return {
          deviceUserId: device._id,
          name: device.name,
          email: device.email,
          isActive: device.isActive,
          role: device.role,
          lastSeenAt: beat?.lastSeenAt,
          online: beat ? beat.lastSeenAt >= onlineThreshold : false,
        };
      }),
    );

    rows.sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
    return rows;
  },
});
