import {
  getConvexTokenOrNull,
  requireWorkspaceRoleApiFromDb,
  requireWorkspaceApiContextForMigration,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContextForMigration(req);
  if ("error" in workspaceContext) return workspaceContext.error;

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

  try {
    const rows = await convex.query("deviceHeartbeat:listStatus", {});
    return Response.json(rows);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat status device QR.");
  }
}
