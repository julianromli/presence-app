import {
  getConvexTokenOrNull,
  requireWorkspaceRoleApiFromDb,
  requireWorkspaceApiContext,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) return workspaceContext.error;
  const workspaceId = workspaceContext.workspace.workspaceId;

  const role = await requireWorkspaceRoleApiFromDb(
    ["superadmin"],
    workspaceContext.workspace.workspaceId,
  );
  if ("error" in role) return role.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json(
      { code: "UNAUTHENTICATED", message: "Unauthorized" },
      { status: 401 },
    );
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex)
    return Response.json(
      { code: "INTERNAL_ERROR", message: "Convex URL missing" },
      { status: 500 },
    );

  try {
    await convex.mutation("settings:ensureGlobal", { workspaceId });
    const data = await convex.query("settings:get", { workspaceId });
    return Response.json(data);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat settings.");
  }
}

export async function PATCH(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) return workspaceContext.error;
  const workspaceId = workspaceContext.workspace.workspaceId;

  const role = await requireWorkspaceRoleApiFromDb(
    ["superadmin"],
    workspaceContext.workspace.workspaceId,
  );
  if ("error" in role) return role.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json(
      { code: "UNAUTHENTICATED", message: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: {
    timezone?: string;
    geofenceEnabled?: boolean;
    geofenceRadiusMeters?: number;
    scanCooldownSeconds?: number;
    minLocationAccuracyMeters?: number;
    enforceDeviceHeartbeat?: boolean;
    geofenceLat?: number;
    geofenceLng?: number;
    whitelistEnabled?: boolean;
    whitelistIps?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { code: "BAD_REQUEST", message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex)
    return Response.json(
      { code: "INTERNAL_ERROR", message: "Convex URL missing" },
      { status: 500 },
    );

  try {
    await convex.mutation("settings:update", {
      workspaceId,
      timezone: body.timezone,
      geofenceEnabled: body.geofenceEnabled,
      geofenceRadiusMeters: body.geofenceRadiusMeters,
      scanCooldownSeconds: body.scanCooldownSeconds,
      minLocationAccuracyMeters: body.minLocationAccuracyMeters,
      enforceDeviceHeartbeat: body.enforceDeviceHeartbeat,
      geofenceLat: body.geofenceLat,
      geofenceLng: body.geofenceLng,
      whitelistEnabled: body.whitelistEnabled,
      whitelistIps: body.whitelistIps,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return convexErrorResponse(error, "Gagal menyimpan settings.");
  }
}

