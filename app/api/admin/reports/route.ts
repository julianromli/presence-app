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
  const workspaceId =
    workspaceContext.workspace.workspaceId === "default-global"
      ? undefined
      : workspaceContext.workspace.workspaceId;

  const role = await requireWorkspaceRoleApiFromDb(
    ["admin", "superadmin"],
    workspaceContext.workspace.workspaceId,
  );
  if ("error" in role) return role.error;

  const token = await getConvexTokenOrNull();
  if (!token)
    return Response.json(
      { code: "UNAUTHENTICATED", message: "Unauthorized" },
      { status: 401 },
    );

  const convex = getAuthedConvexHttpClient(token);
  if (!convex)
    return Response.json(
      { code: "INTERNAL_ERROR", message: "Convex URL missing" },
      { status: 500 },
    );

  try {
    const rows = await convex.query("reports:listWeekly", { workspaceId });
    return Response.json(rows);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat daftar report mingguan.");
  }
}

export async function POST(req: Request) {
  const workspaceContext = requireWorkspaceApiContextForMigration(req);
  if ("error" in workspaceContext) return workspaceContext.error;
  const workspaceId =
    workspaceContext.workspace.workspaceId === "default-global"
      ? undefined
      : workspaceContext.workspace.workspaceId;

  const role = await requireWorkspaceRoleApiFromDb(
    ["admin", "superadmin"],
    workspaceContext.workspace.workspaceId,
  );
  if ("error" in role) return role.error;

  const token = await getConvexTokenOrNull();
  if (!token)
    return Response.json(
      { code: "UNAUTHENTICATED", message: "Unauthorized" },
      { status: 401 },
    );

  const convex = getAuthedConvexHttpClient(token);
  if (!convex)
    return Response.json(
      { code: "INTERNAL_ERROR", message: "Convex URL missing" },
      { status: 500 },
    );

  try {
    const result = await convex.action("reports:triggerWeeklyReport", {
      workspaceId,
    });
    return Response.json(result);
  } catch (error) {
    return convexErrorResponse(
      error,
      "Gagal memproses trigger report mingguan.",
    );
  }
}
