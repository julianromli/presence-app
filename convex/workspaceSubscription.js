import { v } from "convex/values";

import {
  assertPlanLimitNotReached,
  resolveWorkspaceEntitlements,
  resolveWorkspacePlan,
  workspacePlanFeaturesValidator,
  workspacePlanLimitsValidator,
  workspacePlanValidator,
} from "./plans";

export const workspaceSubscriptionUsageValidator = v.object({
  activeMembers: v.number(),
  activeDevices: v.number(),
});

export const workspaceSubscriptionSummaryValidator = v.object({
  plan: workspacePlanValidator,
  limits: workspacePlanLimitsValidator,
  features: workspacePlanFeaturesValidator,
  usage: workspaceSubscriptionUsageValidator,
});

async function listActiveWorkspaceMemberships(ctx, workspaceId) {
  return await ctx.db
    .query("workspace_members")
    .withIndex("by_workspace_active", (q) =>
      q.eq("workspaceId", workspaceId).eq("isActive", true),
    )
    .collect();
}

export async function countActiveWorkspaceMembers(ctx, workspaceId) {
  const activeMemberships = await listActiveWorkspaceMemberships(ctx, workspaceId);
  return activeMemberships.length;
}

async function listActiveWorkspaceDevices(ctx, workspaceId) {
  return await ctx.db
    .query("devices")
    .withIndex("by_workspace_status", (q) =>
      q.eq("workspaceId", workspaceId).eq("status", "active"),
    )
    .collect();
}

export async function countActiveWorkspaceDevices(ctx, workspaceId) {
  const activeDevices = await listActiveWorkspaceDevices(ctx, workspaceId);
  return activeDevices.length;
}

export async function getWorkspaceSubscriptionSummary(ctx, workspace) {
  const plan = resolveWorkspacePlan(workspace);
  const { limits, features } = resolveWorkspaceEntitlements(plan);
  const [activeMemberCount, activeDeviceCount] = await Promise.all([
    countActiveWorkspaceMembers(ctx, workspace._id),
    countActiveWorkspaceDevices(ctx, workspace._id),
  ]);

  return {
    plan,
    limits,
    features,
    usage: {
      activeMembers: activeMemberCount,
      activeDevices: activeDeviceCount,
    },
  };
}

export async function assertWorkspaceActiveMemberLimitNotReached(ctx, workspace) {
  const activeMemberCount = await countActiveWorkspaceMembers(ctx, workspace._id);

  return assertPlanLimitNotReached({
    plan: resolveWorkspacePlan(workspace),
    limitKey: "maxMembersPerWorkspace",
    currentCount: activeMemberCount,
    code: "PLAN_LIMIT_REACHED",
    message: "Jumlah member aktif sudah mencapai batas paket workspace Anda.",
    data: {
      workspaceId: workspace._id,
    },
  });
}

export async function assertWorkspaceActiveDeviceLimitNotReached(ctx, workspace) {
  const activeDeviceCount = await countActiveWorkspaceDevices(ctx, workspace._id);

  return assertPlanLimitNotReached({
    plan: resolveWorkspacePlan(workspace),
    limitKey: "maxDevicesPerWorkspace",
    currentCount: activeDeviceCount,
    code: "PLAN_LIMIT_REACHED",
    message: "Jumlah device aktif sudah mencapai batas paket workspace Anda.",
    data: {
      workspaceId: workspace._id,
    },
  });
}
