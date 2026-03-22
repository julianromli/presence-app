import {
  getConvexTokenOrNull,
  requireWorkspaceApiContext,
  requireWorkspaceRoleApiFromDb,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import type { WorkspaceRestrictedExpiredStatePayload } from "@/types/dashboard";

const RESTRICTION_ACCESS_ROLES = ["superadmin", "admin"] as const;

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }
  const workspaceId = workspaceContext.workspace.workspaceId;

  const roleCheck = await requireWorkspaceRoleApiFromDb(RESTRICTION_ACCESS_ROLES, workspaceId);
  if ("error" in roleCheck) {
    return roleCheck.error;
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
    const payload = await convex.query<WorkspaceRestrictedExpiredStatePayload>(
      "workspaceBilling:getWorkspaceRestrictedExpiredState",
      { workspaceId },
    );
    return Response.json(payload);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat status pembatasan workspace.");
  }
}
