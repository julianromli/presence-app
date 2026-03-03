import { getConvexTokenOrNull, requireRoleApiFromDb } from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";

export async function GET() {
  const role = await requireRoleApiFromDb(["admin", "superadmin"]);
  if ("error" in role) return role.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex)
    return Response.json({ message: "Convex URL missing" }, { status: 500 });

  try {
    const rows = await convex.query("deviceHeartbeat:listStatus", {});
    return Response.json(rows);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat status device QR.");
  }
}
