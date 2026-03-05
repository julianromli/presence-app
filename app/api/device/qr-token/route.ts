import {
  getConvexTokenOrNull,
  requireWorkspaceRoleApiFromDb,
  requireWorkspaceApiContext,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }
  const workspaceId = workspaceContext.workspace.workspaceId;

  const result = await requireWorkspaceRoleApiFromDb(
    ["device-qr"],
    workspaceContext.workspace.workspaceId,
  );
  if ("error" in result) {
    return result.error;
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
    const issued = await convex.mutation("qrTokens:issue", { workspaceId });
    return Response.json(issued);
  } catch (error) {
    return convexErrorResponse(error, "Gagal membuat QR token.");
  }
}

