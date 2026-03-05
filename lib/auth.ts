import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace-context";

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

function forbiddenResponse() {
  return new Response(
    JSON.stringify({ code: "FORBIDDEN", message: "Forbidden" }),
    { status: 403 },
  );
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
  return /^[A-Za-z0-9_-]{6,128}$/.test(workspaceId);
}

export function requireWorkspaceApiContext(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  if (!workspaceId) {
    return {
      error: badRequestResponse("WORKSPACE_REQUIRED", "Missing x-workspace-id header"),
    };
  }

  if (!isWorkspaceIdHeaderValid(workspaceId)) {
    return {
      error: badRequestResponse("WORKSPACE_INVALID", "Invalid x-workspace-id header"),
    };
  }

  return { workspace: { workspaceId } as WorkspaceApiContext };
}

export function requireWorkspaceApiContextForMigration(request: Request) {
  const fromHeader = getWorkspaceIdFromRequest(request);
  if (fromHeader) {
    if (!isWorkspaceIdHeaderValid(fromHeader)) {
      return {
        error: badRequestResponse("WORKSPACE_INVALID", "Invalid x-workspace-id header"),
      };
    }
    return { workspace: { workspaceId: fromHeader } as WorkspaceApiContext };
  }

  const fallbackWorkspaceId =
    process.env.DEFAULT_WORKSPACE_ID ??
    process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID ??
    "default-global";

  return { workspace: { workspaceId: fallbackWorkspaceId } as WorkspaceApiContext };
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
    redirect("/forbidden");
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
  if (!resolvedWorkspaceId || resolvedWorkspaceId === "default-global") {
    return await requireRolePageFromDb(roles);
  }

  const membership = await getCurrentWorkspaceMembershipFromConvex(resolvedWorkspaceId);
  if (!membership || !membership.isActive || !roles.includes(membership.role)) {
    redirect("/forbidden");
  }

  const current = await requireUser();
  if (!current?.user) {
    redirect("/forbidden");
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
  workspaceId?: string,
) {
  const clerkSession = await auth();
  if (!clerkSession.userId) {
    return { error: unauthorizedResponse() };
  }

  if (!workspaceId || workspaceId === "default-global") {
    return await requireRoleApiFromDb(roles);
  }

  const membership = await getCurrentWorkspaceMembershipFromConvex(workspaceId);
  if (!membership || !membership.isActive || !roles.includes(membership.role)) {
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

export const requireRolePage = requireRolePageFromDb;
export const requireRoleApi = requireRoleApiFromDb;
