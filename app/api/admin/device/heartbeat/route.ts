import {
  getConvexTokenOrNull,
  requireWorkspaceRoleApiFromDb,
  requireWorkspaceApiContext,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import { enforceWorkspaceRestriction } from "@/lib/workspace-restriction-guard";

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) return workspaceContext.error;
  const workspaceId = workspaceContext.workspace.workspaceId;

  const role = await requireWorkspaceRoleApiFromDb(
    ["admin", "superadmin"],
    workspaceContext.workspace.workspaceId,
  );
  if ("error" in role) return role.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json(
      { code: "UNAUTHENTICATED", message: "Unauthorized" },
      { status: 401 },
    );
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex)
    return Response.json(
      { code: "INTERNAL_ERROR", message: "Convex URL missing" },
      { status: 500 },
    );

  const restrictionResponse = await enforceWorkspaceRestriction(
    convex,
    workspaceId,
    role.session.role,
    "dashboard_overview",
  );
  if (restrictionResponse) return restrictionResponse;

  try {
    const rows = await convex.query("deviceHeartbeat:listStatus", { workspaceId });
    return Response.json(rows);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat status device permanen.");
  }
}

