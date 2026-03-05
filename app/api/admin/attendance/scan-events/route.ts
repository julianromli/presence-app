import { getConvexTokenOrNull, requireRoleApiFromDb } from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";

export async function GET(req: Request) {
  const role = await requireRoleApiFromDb(["admin", "superadmin"]);
  if ("error" in role) return role.error;

  const searchParams = new URL(req.url).searchParams;
  const dateKey = searchParams.get("dateKey");
  if (!dateKey) {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "dateKey wajib diisi." },
      { status: 400 },
    );
  }

  const statusParam = searchParams.get("status");
  const status =
    statusParam === "accepted" || statusParam === "rejected"
      ? statusParam
      : undefined;
  const rawLimit = Number(searchParams.get("limit") ?? 60);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 200)
    : 60;

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
    const response = await convex.query("attendance:listScanEventsByDate", {
      dateKey,
      status,
      limit,
    });

    return Response.json(response);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat scan events.");
  }
}
