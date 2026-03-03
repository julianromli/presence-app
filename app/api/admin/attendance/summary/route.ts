import { getConvexTokenOrNull, requireRoleApiFromDb } from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";

export async function GET(req: Request) {
  const role = await requireRoleApiFromDb(["admin", "superadmin"]);
  if ("error" in role) return role.error;

  const dateKey = new URL(req.url).searchParams.get("dateKey");
  if (!dateKey) {
    return Response.json({ message: "dateKey wajib" }, { status: 400 });
  }

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex)
    return Response.json({ message: "Convex URL missing" }, { status: 500 });

  try {
    const summary = await convex.query("attendance:getSummaryByDate", {
      dateKey,
    });
    return Response.json(summary);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat ringkasan attendance.");
  }
}
