import { getConvexTokenOrNull } from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";

export async function POST(req: Request) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { code: "BAD_REQUEST", message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  const code = typeof body === "object" && body !== null ? (body as { code?: unknown }).code : undefined;
  if (typeof code !== "string") {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "Field code wajib berupa string." },
      { status: 400 },
    );
  }

  try {
    const result = await convex.mutation("workspaces:joinWorkspaceByCode", {
      code,
    });
    return Response.json(result);
  } catch (error) {
    return convexErrorResponse(error, "Gagal bergabung ke workspace.");
  }
}
