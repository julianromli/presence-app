import {
  requireWorkspaceDeviceApi,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getPublicConvexHttpClient } from "@/lib/convex-http";
import { createExpiredDeviceAuthCookieHeader } from "@/lib/device-auth";

export async function GET(req: Request) {
  const result = await requireWorkspaceDeviceApi(req);
  if ("error" in result) {
    if (result.error.status === 401) {
      result.error.headers.append("Set-Cookie", createExpiredDeviceAuthCookieHeader());
    }
    return result.error;
  }
  const convex = getPublicConvexHttpClient();
  if (!convex) {
    return Response.json(
      { code: "INTERNAL_ERROR", message: "Convex URL missing" },
      { status: 500 },
    );
  }

  try {
    const issued = await convex.mutation("qrTokens:issue", {
      workspaceId: result.workspace.workspaceId,
      deviceId: result.device.deviceId,
    });
    return Response.json(issued);
  } catch (error) {
    return convexErrorResponse(error, "Gagal membuat QR token.");
  }
}
