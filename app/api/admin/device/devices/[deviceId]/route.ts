import {
  getConvexTokenOrNull,
  requireWorkspaceRoleApiFromDb,
  requireWorkspaceApiContext,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";

type RouteContext = {
  params: Promise<{
    deviceId: string;
  }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }

  const role = await requireWorkspaceRoleApiFromDb(
    ["superadmin"],
    workspaceContext.workspace.workspaceId,
  );
  if ("error" in role) {
    return role.error;
  }

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ code: "UNAUTHENTICATED", message: "Unauthorized" }, { status: 401 });
  }

  let body: { label?: string; revoke?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ code: "BAD_REQUEST", message: "Payload JSON tidak valid." }, { status: 400 });
  }

  const { deviceId } = await context.params;
  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ code: "INTERNAL_ERROR", message: "Convex URL missing" }, { status: 500 });
  }

  try {
    const payload = await convex.mutation("devices:updateDevice", {
      workspaceId: workspaceContext.workspace.workspaceId,
      deviceId,
      label: body.label,
      revoke: body.revoke,
    });
    return Response.json(payload);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memperbarui device.");
  }
}
