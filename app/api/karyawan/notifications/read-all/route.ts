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
  beforeTs?: number;
} {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) return workspaceContext.error;
  const workspaceId = workspaceContext.workspace.workspaceId;

  const role = await requireWorkspaceRoleApiFromDb(["karyawan"], workspaceId);
  if ("error" in role) return role.error;

  let body: {
    beforeTs?: number;
  } = {};
  if (req.body !== null) {
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

    body = parsedBody;
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
      "notifications:markAllRead",
      {
        workspaceId,
        beforeTs:
          typeof body.beforeTs === "number" && Number.isFinite(body.beforeTs)
            ? body.beforeTs
            : undefined,
      },
    );
    return Response.json(payload);
  } catch (error) {
    return convexErrorResponse(error, "Gagal menandai semua notifikasi sebagai dibaca.");
  }
}
