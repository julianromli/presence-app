import {
  getConvexTokenOrNull,
  requireWorkspaceApiContext,
  requireWorkspaceRoleApiFromDb,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import type { EmployeeNotificationsPayload } from "@/types/notifications";

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) return workspaceContext.error;
  const workspaceId = workspaceContext.workspace.workspaceId;

  const role = await requireWorkspaceRoleApiFromDb(["karyawan"], workspaceId);
  if ("error" in role) return role.error;

  const params = new URL(req.url).searchParams;
  const rawLimit = Number(params.get("limit") ?? 20);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50)
    : 20;
  const cursorParam = params.get("cursor");
  const cursor = cursorParam && cursorParam.length > 0 ? cursorParam : null;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json(
      { code: "UNAUTHENTICATED", message: "Unauthorized" },
      { status: 401 },
    );
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json(
      { code: "INTERNAL_ERROR", message: "Convex URL missing" },
      { status: 500 },
    );
  }

  try {
    const payload = await convex.query<EmployeeNotificationsPayload>(
      "notifications:listMine",
      {
        workspaceId,
        limit,
        cursor,
      },
    );
    return Response.json(payload);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat notifikasi.");
  }
}
