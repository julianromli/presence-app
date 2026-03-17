import { ConvexError, v } from "convex/values";

export const workspacePlanValidator = v.union(
  v.literal("free"),
  v.literal("pro"),
  v.literal("enterprise"),
);

const PLAN_ORDER = ["free", "pro", "enterprise"];

export const PLAN_CATALOG = {
  free: {
    limits: {
      maxOwnedWorkspaces: 1,
      maxMembersPerWorkspace: 5,
      maxDevicesPerWorkspace: 1,
    },
    features: {
      geofence: false,
      ipWhitelist: false,
      attendanceSchedule: false,
      reportExport: false,
      inviteRotation: true,
      inviteExpiry: false,
    },
  },
  pro: {
    limits: {
      maxOwnedWorkspaces: 5,
      maxMembersPerWorkspace: 50,
      maxDevicesPerWorkspace: 3,
    },
    features: {
      geofence: true,
      ipWhitelist: true,
      attendanceSchedule: true,
      reportExport: true,
      inviteRotation: true,
      inviteExpiry: true,
    },
  },
  enterprise: {
    limits: {
      maxOwnedWorkspaces: null,
      maxMembersPerWorkspace: null,
      maxDevicesPerWorkspace: null,
    },
    features: {
      geofence: true,
      ipWhitelist: true,
      attendanceSchedule: true,
      reportExport: true,
      inviteRotation: true,
      inviteExpiry: true,
    },
  },
};

function isKnownWorkspacePlan(value) {
  return typeof value === "string" && Object.hasOwn(PLAN_CATALOG, value);
}

function extractPlanValue(workspaceLike) {
  if (typeof workspaceLike === "string") {
    return workspaceLike;
  }

  if (workspaceLike && typeof workspaceLike === "object" && "plan" in workspaceLike) {
    return workspaceLike.plan;
  }

  return undefined;
}

function buildInvalidPlanError(plan) {
  return new ConvexError({
    code: "WORKSPACE_PLAN_INVALID",
    message: `WORKSPACE_PLAN_INVALID: Unknown workspace plan "${String(plan)}".`,
  });
}

function cloneEntitlements(entitlements) {
  return {
    limits: { ...entitlements.limits },
    features: { ...entitlements.features },
  };
}

function assertKnownLimitKey(entitlements, limitKey) {
  if (Object.hasOwn(entitlements.limits, limitKey)) {
    return;
  }

  throw new ConvexError({
    code: "WORKSPACE_PLAN_LIMIT_KEY_INVALID",
    message: `WORKSPACE_PLAN_LIMIT_KEY_INVALID: Unknown workspace plan limit key "${String(limitKey)}".`,
    limitKey,
  });
}

function assertKnownFeatureKey(entitlements, featureKey) {
  if (Object.hasOwn(entitlements.features, featureKey)) {
    return;
  }

  throw new ConvexError({
    code: "WORKSPACE_PLAN_FEATURE_KEY_INVALID",
    message: `WORKSPACE_PLAN_FEATURE_KEY_INVALID: Unknown workspace plan feature key "${String(featureKey)}".`,
    featureKey,
  });
}

export function compareWorkspacePlans(left, right) {
  const leftPlan = resolveWorkspacePlan(left);
  const rightPlan = resolveWorkspacePlan(right);
  return PLAN_ORDER.indexOf(leftPlan) - PLAN_ORDER.indexOf(rightPlan);
}

export function resolveWorkspacePlan(workspaceLike) {
  const plan = extractPlanValue(workspaceLike);

  if (plan === undefined || plan === null || plan === "") {
    return "free";
  }

  if (!isKnownWorkspacePlan(plan)) {
    throw buildInvalidPlanError(plan);
  }

  return plan;
}

export function resolveWorkspaceEntitlements(plan) {
  const resolvedPlan = resolveWorkspacePlan(plan);
  return cloneEntitlements(PLAN_CATALOG[resolvedPlan]);
}

export function isPlanLimitReached(limit, currentCount) {
  if (limit === null) {
    return false;
  }

  return currentCount >= limit;
}

export function assertPlanLimitNotReached({
  plan,
  limitKey,
  currentCount,
  code = "PLAN_LIMIT_REACHED",
  message,
  data,
}) {
  const resolvedPlan = resolveWorkspacePlan(plan);
  const entitlements = resolveWorkspaceEntitlements(resolvedPlan);
  assertKnownLimitKey(entitlements, limitKey);
  const limit = entitlements.limits[limitKey];

  if (!isPlanLimitReached(limit, currentCount)) {
    return entitlements;
  }

  throw new ConvexError({
    code,
    message:
      message ??
      `PLAN_LIMIT_REACHED: ${limitKey} limit reached for the ${resolvedPlan} workspace plan.`,
    plan: resolvedPlan,
    limitKey,
    limit,
    currentCount,
    ...(data ?? {}),
  });
}

export function assertWorkspaceFeatureEnabled({
  plan,
  featureKey,
  code = "FEATURE_NOT_AVAILABLE",
  message,
  data,
}) {
  const resolvedPlan = resolveWorkspacePlan(plan);
  const entitlements = resolveWorkspaceEntitlements(resolvedPlan);
  assertKnownFeatureKey(entitlements, featureKey);
  const enabled = entitlements.features[featureKey];

  if (enabled) {
    return entitlements;
  }

  throw new ConvexError({
    code,
    message:
      message ??
      `FEATURE_NOT_AVAILABLE: ${featureKey} requires Pro or Enterprise.`,
    plan: resolvedPlan,
    featureKey,
    ...(data ?? {}),
  });
}
