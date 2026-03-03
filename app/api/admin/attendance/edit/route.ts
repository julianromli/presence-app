import { getConvexTokenOrNull, requireRoleApiFromDb } from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";

export async function PATCH(req: Request) {
  const role = await requireRoleApiFromDb(["admin", "superadmin"]);
  if ("error" in role) return role.error;

  let body: {
    attendanceId?: string;
    checkInAt?: number;
    checkOutAt?: number;
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

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex)
    return Response.json({ message: "Convex URL missing" }, { status: 500 });

  try {
    await convex.mutation("attendance:editAttendance", {
      attendanceId: body.attendanceId,
      checkInAt: body.checkInAt,
      checkOutAt: body.checkOutAt,
      reason: body.reason,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return convexErrorResponse(error, "Gagal mengedit attendance.");
  }
}
