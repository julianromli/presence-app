import { requireWorkspaceApiContext } from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getPublicConvexHttpClient } from "@/lib/convex-http";

export async function POST(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }

  let body: { code?: string; label?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { code: "BAD_REQUEST", message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  const code = body.code?.trim();
  const label = body.label?.trim();
  if (!code || !label) {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "Kode dan nama device wajib diisi." },
      { status: 400 },
    );
  }

  const convex = getPublicConvexHttpClient();
  if (!convex) {
    return Response.json(
      { code: "INTERNAL_ERROR", message: "Convex URL missing" },
      { status: 500 },
    );
  }

  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = req.headers.get("user-agent") ?? undefined;

  try {
    const response = await convex.mutation("devices:claimRegistrationCode", {
      workspaceId: workspaceContext.workspace.workspaceId,
      code,
      label,
      ipAddress,
      userAgent,
    });

    return Response.json(response);
  } catch (error) {
    return convexErrorResponse(error, "Gagal mengklaim device.");
  }
}
