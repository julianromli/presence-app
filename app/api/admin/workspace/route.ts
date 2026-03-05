import { ConvexError } from "convex/values";

import {
  getConvexTokenOrNull,
  requireWorkspaceApiContext,
  requireWorkspaceRoleApiFromDb,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import type { WorkspaceManagementPayload } from "@/types/dashboard";

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }
  const workspaceId = workspaceContext.workspace.workspaceId;

  const roleCheck = await requireWorkspaceRoleApiFromDb(["superadmin"], workspaceId);
  if ("error" in roleCheck) return roleCheck.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ code: "UNAUTHENTICATED", message: "Unauthorized" }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ code: "INTERNAL_ERROR", message: "Convex URL missing" }, { status: 500 });
  }

  try {
    const payload = await convex.query<WorkspaceManagementPayload>("workspaces:workspaceManagementDetail", {
      workspaceId,
    });
    return Response.json(payload);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat data workspace management.");
  }
}

export async function PATCH(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }
  const workspaceId = workspaceContext.workspace.workspaceId;

  const roleCheck = await requireWorkspaceRoleApiFromDb(["superadmin"], workspaceId);
  if ("error" in roleCheck) return roleCheck.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ code: "UNAUTHENTICATED", message: "Unauthorized" }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ code: "INTERNAL_ERROR", message: "Convex URL missing" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { code: "BAD_REQUEST", message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  const name = typeof body === "object" && body !== null ? (body as { name?: unknown }).name : undefined;
  if (typeof name !== "string") {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "Field name wajib berupa string." },
      { status: 400 },
    );
  }

  try {
    const payload = await convex.mutation("workspaces:renameWorkspace", {
      workspaceId,
      name,
    });
    return Response.json(payload);
  } catch (error) {
    if (error instanceof ConvexError) {
      return convexErrorResponse(error, "Gagal mengubah nama workspace.");
    }
    return convexErrorResponse(error, "Gagal mengubah nama workspace.");
  }
}

export async function POST(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }
  const workspaceId = workspaceContext.workspace.workspaceId;

  const roleCheck = await requireWorkspaceRoleApiFromDb(["superadmin"], workspaceId);
  if ("error" in roleCheck) return roleCheck.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ code: "UNAUTHENTICATED", message: "Unauthorized" }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ code: "INTERNAL_ERROR", message: "Convex URL missing" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { code: "BAD_REQUEST", message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  const action = typeof body === "object" && body !== null ? (body as { action?: unknown }).action : undefined;
  if (action !== "rotateInviteCode") {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "Action tidak valid." },
      { status: 400 },
    );
  }

  try {
    const payload = await convex.mutation("workspaces:rotateWorkspaceInviteCode", {
      workspaceId,
    });
    return Response.json(payload);
  } catch (error) {
    if (error instanceof ConvexError) {
      return convexErrorResponse(error, "Gagal merotasi invitation code.");
    }
    return convexErrorResponse(error, "Gagal merotasi invitation code.");
  }
}
