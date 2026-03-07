import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";

import {
  DEVICE_KEY_HEADER,
  parseDeviceKey,
  type ParsedDeviceKey,
} from "./device-auth";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import { ACTIVE_WORKSPACE_COOKIE, isValidWorkspaceId } from "@/lib/workspace-context";

export const APP_ROLES = [
  "superadmin",
  "admin",
  "karyawan",
  "device-qr",
] as const;
export type AppRole = (typeof APP_ROLES)[number];

export type DbUserSession = {
  _id: string;
  name: string;
  email: string;
  role: AppRole;
  isActive: boolean;
  clerkUserId: string;
  createdAt: number;
  updatedAt: number;
  _creationTime: number;
};

export type WorkspaceApiContext = {
  workspaceId: string;
};

export type DeviceApiSession = {
  deviceId: string;
  label: string;
  claimedAt: number;
};

type WorkspaceApiResult =
  | { error: Response }
  | { workspace: WorkspaceApiContext };

type DeviceApiResult =
  | { error: Response }
  | {
      workspace: WorkspaceApiContext;
      device: DeviceApiSession;
    };

type WorkspaceMembershipSession = {
  membershipId: string;
  role: AppRole;
  isActive: boolean;
  workspace: {
    _id: string;
    _creationTime: number;
    slug: string;
    name: string;
    isActive: boolean;
    createdAt: number;
    updatedAt: number;
    createdByUserId?: string;
  };
};

type OnboardingState = {
  hasActiveMembership: boolean;
  memberships: WorkspaceMembershipSession[];
};

function forbiddenResponse() {
  return new Response(
    JSON.stringify({ code: "FORBIDDEN", message: "Forbidden" }),
    { status: 403 },
  );
}

function logWorkspaceViolation(
  code: "WORKSPACE_REQUIRED" | "WORKSPACE_INVALID" | "FORBIDDEN",
  detail: Record<string, string | boolean | null | undefined>,
) {
  console.warn("[workspace-policy-violation]", {
    code,
    ...detail,
  });
}

function badRequestResponse(code: string, message: string) {
  return new Response(
    JSON.stringify({ code, message }),
    { status: 400 },
  );
}

function unauthorizedResponse() {
  return new Response(
    JSON.stringify({ code: "UNAUTHENTICATED", message: "Unauthorized" }),
    { status: 401 },
  );
}

function deviceUnauthorizedResponse() {
  return new Response(
    JSON.stringify({ code: "DEVICE_UNAUTHORIZED", message: "Unauthorized device" }),
    { status: 401 },
  );
}

function workspaceRecoveryResponse(
  code: "ONBOARDING_REQUIRED" | "WORKSPACE_ACCESS_LOST",
  message: string,
) {
  return new Response(JSON.stringify({ code, message }), {
    status: 409,
    headers: { "content-type": "application/json" },
  });
}

export async function getConvexTokenOrNull() {
  const session = await auth();
  if (!session.userId) {
    return null;
  }

  return (await session.getToken({ template: "convex" })) ?? null;
}

export function getWorkspaceIdFromRequest(request: Request) {
  const raw = request.headers.get("x-workspace-id");
  if (!raw) {
    return null;
  }
  const workspaceId = raw.trim();
  if (!workspaceId) {
    return null;
  }
  return workspaceId;
}

function isWorkspaceIdHeaderValid(workspaceId: string) {
  return isValidWorkspaceId(workspaceId);
}

export function requireWorkspaceApiContext(
  request: Request,
): WorkspaceApiResult {
  const workspaceId = getWorkspaceIdFromRequest(request);
  if (!workspaceId) {
    logWorkspaceViolation("WORKSPACE_REQUIRED", {
      path: new URL(request.url).pathname,
      hasHeader: false,
    });
    return {
      error: badRequestResponse("WORKSPACE_REQUIRED", "Missing x-workspace-id header"),
    };
  }

  if (!isWorkspaceIdHeaderValid(workspaceId)) {
    logWorkspaceViolation("WORKSPACE_INVALID", {
      path: new URL(request.url).pathname,
      workspaceId,
    });
    return {
      error: badRequestResponse("WORKSPACE_INVALID", "Invalid x-workspace-id header"),
    };
  }

  return { workspace: { workspaceId } as WorkspaceApiContext };
}

export function getDeviceKeyFromRequest(request: Request): ParsedDeviceKey | null {
  return parseDeviceKey(request.headers.get(DEVICE_KEY_HEADER));
}

async function getCurrentDbUserFromConvex(): Promise<DbUserSession | null> {
  const token = await getConvexTokenOrNull();
  if (!token) {
    return null;
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return null;
  }

  try {
    const user = await convex.query<DbUserSession | null>("users:me", {});
    return user;
  } catch {
    return null;
  }
}

async function getCurrentWorkspaceMembershipFromConvex(
  workspaceId: string,
): Promise<WorkspaceMembershipSession | null> {
  const token = await getConvexTokenOrNull();
  if (!token) {
    return null;
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return null;
  }

  try {
    return await convex.query<WorkspaceMembershipSession | null>(
      "workspaces:myMembershipByWorkspace",
      { workspaceId },
    );
  } catch {
    return null;
  }
}

async function getOnboardingMembershipsFromConvex(): Promise<WorkspaceMembershipSession[]> {
  const token = await getConvexTokenOrNull();
  if (!token) {
    return [];
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return [];
  }

  try {
    const onboardingState = await convex.query<OnboardingState>("workspaces:myOnboardingState", {});
    return onboardingState.memberships;
  } catch {
    return [];
  }
}

export async function getCurrentSession() {
  const session = await auth();
  const dbUser = await getCurrentDbUserFromConvex();

  return {
    userId: session.userId,
    role: dbUser?.role ?? null,
    user: dbUser,
  };
}

export async function requireUser() {
  const session = await getCurrentSession();
  if (!session.userId || !session.user) {
    return null;
  }
  return session;
}

export async function requireRolePageFromDb(roles: AppRole[]) {
  const session = await auth();
  if (!session.userId) {
    redirect("/sign-in");
  }

  const current = await requireUser();
  if (!current || !current.role || !roles.includes(current.role)) {
    forbidden();
  }

  return current;
}

async function getWorkspaceIdFromCookie() {
  const jar = await cookies();
  const raw = jar.get(ACTIVE_WORKSPACE_COOKIE)?.value?.trim();
  if (!raw || !isWorkspaceIdHeaderValid(raw)) {
    return null;
  }
  return raw;
}

export async function requireWorkspaceRolePageFromDb(
  roles: AppRole[],
  workspaceId?: string,
) {
  const session = await auth();
  if (!session.userId) {
    redirect("/sign-in");
  }

  const resolvedWorkspaceId = workspaceId ?? (await getWorkspaceIdFromCookie());
  const memberships = await getOnboardingMembershipsFromConvex();

  if (memberships.length === 0) {
    redirect("/onboarding/workspace");
  }

  let membership: WorkspaceMembershipSession | null = null;

  if (resolvedWorkspaceId) {
    membership = memberships.find((item) => item.workspace._id === resolvedWorkspaceId) ?? null;
    if (!membership) {
      membership = await getCurrentWorkspaceMembershipFromConvex(resolvedWorkspaceId);
    }
  }

  if (!membership) {
    membership =
      memberships.find((item) => item.isActive && roles.includes(item.role) && item.workspace.isActive) ?? null;
  }

  if (!membership) {
    const hasAnyActiveMembership = memberships.some((item) => item.isActive && item.workspace.isActive);
    if (hasAnyActiveMembership) {
      forbidden();
    }
    redirect("/onboarding/workspace");
  }

  if (!membership.isActive || !membership.workspace.isActive || !roles.includes(membership.role)) {
    forbidden();
  }

  const current = await requireUser();
  if (!current?.user) {
    forbidden();
  }

  return {
    userId: current.userId,
    role: membership.role,
    user: current.user,
    workspace: membership.workspace,
  };
}

export async function requireWorkspaceOnboardingPage() {
  const session = await auth();
  if (!session.userId) {
    redirect("/sign-in");
  }

  const token = await getConvexTokenOrNull();
  if (!token) {
    return null;
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return null;
  }

  try {
    const onboardingState = await convex.query<{
      hasActiveMembership: boolean;
    }>("workspaces:myOnboardingState", {});

    if (!onboardingState.hasActiveMembership) {
      redirect("/onboarding/workspace");
    }

    return onboardingState;
  } catch {
    return null;
  }
}

export async function requireRoleApiFromDb(roles: AppRole[]) {
  const clerkSession = await auth();
  if (!clerkSession.userId) {
    return { error: unauthorizedResponse() };
  }

  const session = await requireUser();
  if (!session || !session.role) {
    return { error: forbiddenResponse() };
  }

  if (!roles.includes(session.role)) {
    return { error: forbiddenResponse() };
  }

  return { session };
}

export async function requireWorkspaceRoleApiFromDb(
  roles: AppRole[],
  workspaceId: string,
) {
  const clerkSession = await auth();
  if (!clerkSession.userId) {
    return { error: unauthorizedResponse() };
  }

  const membership = await getCurrentWorkspaceMembershipFromConvex(workspaceId);
  if (!membership || !membership.isActive || !membership.workspace.isActive) {
    const memberships = await getOnboardingMembershipsFromConvex();
    const hasAnyActiveMembership = memberships.some(
      (item) => item.isActive && item.workspace.isActive,
    );

    if (!hasAnyActiveMembership) {
      logWorkspaceViolation("FORBIDDEN", {
        workspaceId,
        userId: clerkSession.userId,
        reason: "NO_ACTIVE_MEMBERSHIPS",
      });
      return {
        error: workspaceRecoveryResponse(
          "ONBOARDING_REQUIRED",
          "Anda belum memiliki akses workspace aktif.",
        ),
      };
    }

    logWorkspaceViolation("FORBIDDEN", {
      workspaceId,
      userId: clerkSession.userId,
      reason: "MEMBERSHIP_REQUIRED",
    });
    return { error: forbiddenResponse() };
  }

  if (!roles.includes(membership.role)) {
    logWorkspaceViolation("FORBIDDEN", {
      workspaceId,
      userId: clerkSession.userId,
      reason: "ROLE_MISMATCH",
    });
    return { error: forbiddenResponse() };
  }

  const current = await requireUser();
  if (!current?.user) {
    return { error: forbiddenResponse() };
  }

  return {
    session: {
      userId: current.userId,
      role: membership.role,
      user: current.user,
      workspace: membership.workspace,
    },
  };
}

export async function requireWorkspaceDeviceApi(
  request: Request,
): Promise<DeviceApiResult> {
  const workspaceContext = requireWorkspaceApiContext(request);
  if ("error" in workspaceContext) {
    return { error: workspaceContext.error };
  }

  const deviceKey = getDeviceKeyFromRequest(request);
  if (!deviceKey) {
    return { error: deviceUnauthorizedResponse() };
  }

  const { getPublicConvexHttpClient } = await import("@/lib/convex-http");
  const convex = getPublicConvexHttpClient();
  if (!convex) {
    return {
      error: Response.json(
        { code: "INTERNAL_ERROR", message: "Convex URL missing" },
        { status: 500 },
      ),
    };
  }

  try {
    const device = await convex.query<DeviceApiSession | null>("devices:authenticateDevice", {
      workspaceId: workspaceContext.workspace.workspaceId,
      deviceId: deviceKey.deviceId,
      secret: deviceKey.secret,
    });

    if (!device) {
      return { error: deviceUnauthorizedResponse() };
    }

    return {
      workspace: workspaceContext.workspace,
      device,
    };
  } catch {
    return {
      error: Response.json(
        { code: "INTERNAL_ERROR", message: "Gagal memverifikasi device." },
        { status: 500 },
      ),
    };
  }
}

export const requireRolePage = requireRolePageFromDb;
export const requireRoleApi = requireRoleApiFromDb;
