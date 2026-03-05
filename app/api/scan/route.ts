import {
  getConvexTokenOrNull,
  requireWorkspaceRoleApiFromDb,
  requireWorkspaceApiContext,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";

export async function POST(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }
  const workspaceId = workspaceContext.workspace.workspaceId;

  const roleResult = await requireWorkspaceRoleApiFromDb(
    ["karyawan"],
    workspaceContext.workspace.workspaceId,
  );
  if ("error" in roleResult) {
    return roleResult.error;
  }

  let body: {
    token?: string;
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    idempotencyKey?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { code: "BAD_REQUEST", message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  if (!body.token) {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "Token wajib diisi" },
      { status: 400 },
    );
  }

  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
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
    const response = await convex.mutation("attendance:recordScan", {
      workspaceId,
      token: body.token,
      ipAddress,
      latitude: body.latitude,
      longitude: body.longitude,
      accuracyMeters: body.accuracyMeters,
      idempotencyKey: body.idempotencyKey,
    });

    return Response.json(response);
  } catch (error) {
    return convexErrorResponse(error, "Scan gagal diproses.");
  }
}

