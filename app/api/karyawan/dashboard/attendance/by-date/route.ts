import {
  getConvexTokenOrNull,
  requireWorkspaceApiContext,
  requireWorkspaceRoleApiFromDb,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import type { EmployeeAttendanceByDatePayload } from "@/types/dashboard";

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateKey(dateKey: string) {
  if (!DATE_KEY_REGEX.test(dateKey)) {
    return false;
  }

  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.toISOString().slice(0, 10) === dateKey;
}

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) return workspaceContext.error;
  const workspaceId = workspaceContext.workspace.workspaceId;

  const role = await requireWorkspaceRoleApiFromDb(["karyawan"], workspaceId);
  if ("error" in role) return role.error;

  const params = new URL(req.url).searchParams;
  const dateKey = params.get("dateKey")?.trim() ?? "";
  if (!dateKey || !isValidDateKey(dateKey)) {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "dateKey tidak valid." },
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
    const payload = await convex.query<EmployeeAttendanceByDatePayload>(
      "dashboardEmployee:getAttendanceByDate",
      {
        workspaceId,
        dateKey,
      },
    );
    return Response.json(payload);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat detail absensi.");
  }
}
