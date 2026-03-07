import {
  getConvexTokenOrNull,
  requireWorkspaceRoleApiFromDb,
  requireWorkspaceApiContext,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }

  const role = await requireWorkspaceRoleApiFromDb(
    ["superadmin"],
    workspaceContext.workspace.workspaceId,
  );
  if ("error" in role) {
    return role.error;
  }

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ code: "UNAUTHENTICATED", message: "Unauthorized" }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ code: "INTERNAL_ERROR", message: "Convex URL missing" }, { status: 500 });
  }

  try {
    const rows = await convex.query("devices:listRegistrationCodes", {
      workspaceId: workspaceContext.workspace.workspaceId,
    });
    return Response.json(rows);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat registration code.");
  }
}

export async function POST(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }

  const role = await requireWorkspaceRoleApiFromDb(
    ["superadmin"],
    workspaceContext.workspace.workspaceId,
  );
  if ("error" in role) {
    return role.error;
  }

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ code: "UNAUTHENTICATED", message: "Unauthorized" }, { status: 401 });
  }

  let body: { ttlMs?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ code: "INTERNAL_ERROR", message: "Convex URL missing" }, { status: 500 });
  }

  try {
    const payload = await convex.mutation("devices:createRegistrationCode", {
      workspaceId: workspaceContext.workspace.workspaceId,
      ttlMs: body.ttlMs,
    });
    return Response.json(payload);
  } catch (error) {
    return convexErrorResponse(error, "Gagal membuat registration code.");
  }
}
