import {
  getConvexTokenOrNull,
  requireWorkspaceApiContext,
  requireWorkspaceRoleApiFromDb,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import type { WorkspaceBillingSummaryPayload } from "@/types/dashboard";

export async function POST(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }
  const workspaceId = workspaceContext.workspace.workspaceId;

  const roleCheck = await requireWorkspaceRoleApiFromDb(
    ["superadmin"],
    workspaceId,
  );
  if ("error" in roleCheck) {
    return roleCheck.error;
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
    const payload = await convex.action<WorkspaceBillingSummaryPayload>(
      "workspaceBilling:cancelWorkspacePendingInvoice",
      { workspaceId },
    );
    return Response.json(payload);
  } catch (error) {
    return convexErrorResponse(
      error,
      "Gagal membatalkan invoice pending workspace.",
    );
  }
}
