import { requireWorkspaceApiContext } from "@/lib/auth";
import { getPublicConvexHttpClient } from "@/lib/convex-http";

type DeviceWorkspacePreview = {
  workspaceId: string;
  name: string;
};

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }

  const convex = getPublicConvexHttpClient();
  if (!convex) {
    return Response.json(
      { code: "INTERNAL_ERROR", message: "Convex URL missing" },
      { status: 500 },
    );
  }

  const payload = await convex.query<DeviceWorkspacePreview | null>(
    "workspaces:deviceWorkspacePreview",
    {
      workspaceId: workspaceContext.workspace.workspaceId,
    },
  );

  if (!payload) {
    return Response.json(
      { code: "WORKSPACE_INVALID", message: "Workspace tidak ditemukan." },
      { status: 404 },
    );
  }

  return Response.json(payload);
}
