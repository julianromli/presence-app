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

function listActiveWorkspaceMemberships(ctx, workspaceId) {
  return ctx.db
    .query("workspace_members")
    .withIndex("by_workspace_active", (q) =>
      q.eq("workspaceId", workspaceId).eq("isActive", true),
    );
}

async function countPaginatedQuery(query, pageSize = 128) {
  let count = 0;
  let cursor = null;

  while (true) {
    const page = await query.paginate({
      cursor,
      numItems: pageSize,
    });
    count += page.page.length;

    if (page.isDone) {
      return count;
    }

    cursor = page.continueCursor;
  }
}

async function countActiveWorkspaceMemberships(ctx, workspaceId) {
  return countPaginatedQuery(listActiveWorkspaceMemberships(ctx, workspaceId));
}

function listActiveWorkspaceDevices(ctx, workspaceId) {
  return ctx.db
    .query("devices")
    .withIndex("by_workspace_status", (q) =>
      q.eq("workspaceId", workspaceId).eq("status", "active"),
    );
}

async function countActiveWorkspaceDevices(ctx, workspaceId) {
  const activeDevices = await listActiveWorkspaceDevices(ctx, workspaceId).collect();
  return activeDevices.length;
}

export async function getWorkspaceSubscriptionSummary(ctx, workspace) {
  const plan = resolveWorkspacePlan(workspace);
  const { limits, features } = resolveWorkspaceEntitlements(plan);
  const [activeMemberCount, activeDeviceCount] = await Promise.all([
    countActiveWorkspaceMemberships(ctx, workspace._id),
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
  const plan = resolveWorkspacePlan(workspace);
  const { limits } = resolveWorkspaceEntitlements(plan);
  const activeMemberships =
    limits.maxMembersPerWorkspace === null
      ? []
      : await listActiveWorkspaceMemberships(ctx, workspace._id).take(
          limits.maxMembersPerWorkspace,
        );

  return assertPlanLimitNotReached({
    plan,
    limitKey: "maxMembersPerWorkspace",
    currentCount: activeMemberships.length,
    code: "PLAN_LIMIT_REACHED",
    message: "Jumlah member aktif sudah mencapai batas paket workspace Anda.",
    data: {
      workspaceId: workspace._id,
    },
  });
}

export async function assertWorkspaceActiveDeviceLimitNotReached(ctx, workspace) {
  const plan = resolveWorkspacePlan(workspace);
  const { limits } = resolveWorkspaceEntitlements(plan);
  const activeDevices =
    limits.maxDevicesPerWorkspace === null
      ? []
      : await listActiveWorkspaceDevices(ctx, workspace._id).take(
          limits.maxDevicesPerWorkspace,
        );

  return assertPlanLimitNotReached({
    plan,
    limitKey: "maxDevicesPerWorkspace",
    currentCount: activeDevices.length,
    code: "PLAN_LIMIT_REACHED",
    message: "Jumlah device aktif sudah mencapai batas paket workspace Anda.",
    data: {
      workspaceId: workspace._id,
    },
  });
}
