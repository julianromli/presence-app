import {
  getConvexTokenOrNull,
  requireWorkspaceApiContext,
  requireWorkspaceRoleApiFromDb,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import type { EmployeeNotificationReadPayload } from "@/types/notifications";

function isJsonObject(
  value: unknown,
): value is {
  notificationId?: string;
} {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) return workspaceContext.error;
  const workspaceId = workspaceContext.workspace.workspaceId;

  const role = await requireWorkspaceRoleApiFromDb(["karyawan"], workspaceId);
  if ("error" in role) return role.error;

  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return Response.json(
      { code: "BAD_REQUEST", message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  if (!isJsonObject(parsedBody)) {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "Payload JSON harus berupa object." },
      { status: 400 },
    );
  }

  const notificationId =
    typeof parsedBody.notificationId === "string"
      ? parsedBody.notificationId.trim()
      : "";
  if (!notificationId) {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "notificationId wajib diisi." },
      { status: 400 },
    );
  }

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
    const payload = await convex.mutation<EmployeeNotificationReadPayload>(
      "notifications:markRead",
      {
        workspaceId,
        notificationId,
      },
    );
    return Response.json(payload);
  } catch (error) {
    return convexErrorResponse(error, "Gagal menandai notifikasi sebagai dibaca.");
  }
}
