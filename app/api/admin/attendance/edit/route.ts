import {
  getConvexTokenOrNull,
  requireWorkspaceRoleApiFromDb,
  requireWorkspaceApiContext,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import { enforceWorkspaceRestriction } from "@/lib/workspace-restriction-guard";
import {
  isValidClockValue,
  resolveDateKeyClockToTimestamp,
} from "@/lib/timezone-clock";

export async function PATCH(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) return workspaceContext.error;
  const workspaceId = workspaceContext.workspace.workspaceId;

  const role = await requireWorkspaceRoleApiFromDb(
    ["admin", "superadmin"],
    workspaceContext.workspace.workspaceId,
  );
  if ("error" in role) return role.error;

  let body: {
    attendanceId?: string;
    dateKey?: string;
    checkInAt?: number;
    checkOutAt?: number;
    checkInTime?: string;
    checkOutTime?: string;
    reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { code: "BAD_REQUEST", message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  if (!body.attendanceId || !body.reason) {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "attendanceId dan reason wajib" },
      { status: 400 },
    );
  }

  if (
    body.checkInAt !== undefined &&
    !Number.isFinite(body.checkInAt)
  ) {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "checkInAt tidak valid." },
      { status: 400 },
    );
  }

  if (
    body.checkOutAt !== undefined &&
    !Number.isFinite(body.checkOutAt)
  ) {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "checkOutAt tidak valid." },
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
    let checkInAt = body.checkInAt;
    let checkOutAt = body.checkOutAt;

    const hasClockPayload =
      body.checkInTime !== undefined || body.checkOutTime !== undefined;
    if (hasClockPayload) {
      if (!body.dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(body.dateKey)) {
        return Response.json(
          { code: "VALIDATION_ERROR", message: "dateKey wajib valid." },
          { status: 400 },
        );
      }

      if (
        body.checkInTime !== undefined &&
        body.checkInTime.length > 0 &&
        !isValidClockValue(body.checkInTime)
      ) {
        return Response.json(
          { code: "VALIDATION_ERROR", message: "checkInTime tidak valid." },
          { status: 400 },
        );
      }

      if (
        body.checkOutTime !== undefined &&
        body.checkOutTime.length > 0 &&
        !isValidClockValue(body.checkOutTime)
      ) {
        return Response.json(
          { code: "VALIDATION_ERROR", message: "checkOutTime tidak valid." },
          { status: 400 },
        );
      }

      const settings = await convex.query<{ timezone?: string }>("settings:get", {
        workspaceId,
      });
      checkInAt = resolveDateKeyClockToTimestamp(
        body.dateKey,
        body.checkInTime,
        settings.timezone,
      );
      checkOutAt = resolveDateKeyClockToTimestamp(
        body.dateKey,
        body.checkOutTime,
        settings.timezone,
      );
    }

    await convex.mutation("attendance:editAttendance", {
      workspaceId,
      attendanceId: body.attendanceId,
      checkInAt,
      checkOutAt,
      reason: body.reason,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return convexErrorResponse(error, "Gagal mengedit attendance.");
  }
}

