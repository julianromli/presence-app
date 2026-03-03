import { getConvexTokenOrNull, requireRoleApiFromDb } from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";

export async function GET() {
  const result = await requireRoleApiFromDb(["device-qr"]);
  if ("error" in result) {
    return result.error;
  }

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ message: "Convex URL missing" }, { status: 500 });
  }

  try {
    const issued = await convex.mutation("qrTokens:issue", {});
    return Response.json(issued);
  } catch (error) {
    return convexErrorResponse(error, "Gagal membuat QR token.");
  }
}
