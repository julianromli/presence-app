import { requireWorkspaceApiContext } from "@/lib/auth";
import { getPublicConvexHttpClient } from "@/lib/convex-http";

export async function POST(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { code: "BAD_REQUEST", message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  const code = body.code?.trim();
  if (!code) {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "Kode registrasi wajib diisi." },
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

  const result = await convex.query<{
    ok: boolean;
    expiresAt?: number;
  }>("devices:validateRegistrationCodePreview", {
    workspaceId: workspaceContext.workspace.workspaceId,
    code,
  });

  if (!result.ok) {
    return Response.json(
      { ok: false, message: "Kode tidak valid atau sudah tidak aktif." },
      { status: 400 },
    );
  }

  return Response.json({
    ok: true,
    expiresAt: result.expiresAt,
  });
}
