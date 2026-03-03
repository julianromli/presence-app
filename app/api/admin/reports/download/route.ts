import { NextResponse } from "next/server";

import { getConvexTokenOrNull, requireRoleApiFromDb } from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";

export async function GET(req: Request) {
  const role = await requireRoleApiFromDb(["admin", "superadmin"]);
  if ("error" in role) return role.error;

  const reportId = new URL(req.url).searchParams.get("reportId");
  if (!reportId) {
    return Response.json({ message: "reportId wajib diisi" }, { status: 400 });
  }

  const token = await getConvexTokenOrNull();
  if (!token)
    return Response.json({ message: "Unauthorized" }, { status: 401 });

  const convex = getAuthedConvexHttpClient(token);
  if (!convex)
    return Response.json({ message: "Convex URL missing" }, { status: 500 });

  try {
    const report = await convex.query<{ url?: string; fileName?: string }>(
      "reports:getDownloadUrl",
      {
        reportId,
      },
    );

    if (!report.url) {
      return Response.json(
        { code: "NOT_FOUND", message: "File report belum tersedia" },
        { status: 404 },
      );
    }

    return NextResponse.redirect(report.url);
  } catch (error) {
    return convexErrorResponse(error, "Gagal mengunduh report.");
  }
}
