import { convexErrorResponse } from "@/lib/api-error";
import { getPublicConvexHttpClient } from "@/lib/convex-http";
import { getRequestRateLimitKey } from "@/lib/request-ip";

export async function POST(req: Request) {
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

  try {
    const result = await convex.mutation<{
      ok: boolean;
      expiresAt?: number;
      workspace?: {
        workspaceId: string;
        name: string;
      };
    }>("devices:validateRegistrationCodePreview", {
      code,
      rateLimitKey: getRequestRateLimitKey(req) ?? undefined,
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
      workspace: result.workspace,
    });
  } catch (error) {
    return convexErrorResponse(error, "Gagal memvalidasi registration code.");
  }
}
