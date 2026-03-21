import { ConvexError } from "convex/values";

import {
  getConvexTokenOrNull,
  requireWorkspaceApiContext,
  requireWorkspaceRoleApiFromDb,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import { enforceWorkspaceRestriction } from "@/lib/workspace-restriction-guard";
import type { WorkspaceManagementPayload } from "@/types/dashboard";

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }
  const workspaceId = workspaceContext.workspace.workspaceId;

  const roleCheck = await requireWorkspaceRoleApiFromDb(["superadmin"], workspaceId);
  if ("error" in roleCheck) return roleCheck.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ code: "UNAUTHENTICATED", message: "Unauthorized" }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ code: "INTERNAL_ERROR", message: "Convex URL missing" }, { status: 500 });
  }

  const restrictionResponse = await enforceWorkspaceRestriction(
    convex,
    workspaceId,
    roleCheck.session.role,
    "dashboard_overview",
  );
  if (restrictionResponse) {
    return restrictionResponse;
  }

  try {
    const payload = await convex.query<WorkspaceManagementPayload>("workspaces:workspaceManagementDetail", {
      workspaceId,
    });
    return Response.json(payload);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat data workspace management.");
  }
}

export async function PATCH(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }
  const workspaceId = workspaceContext.workspace.workspaceId;

  const roleCheck = await requireWorkspaceRoleApiFromDb(["superadmin"], workspaceId);
  if ("error" in roleCheck) return roleCheck.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ code: "UNAUTHENTICATED", message: "Unauthorized" }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ code: "INTERNAL_ERROR", message: "Convex URL missing" }, { status: 500 });
  }

  const restrictionResponse = await enforceWorkspaceRestriction(
    convex,
    workspaceId,
    roleCheck.session.role,
    "dashboard_overview",
  );
  if (restrictionResponse) {
    return restrictionResponse;
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

  const name = typeof body === "object" && body !== null ? (body as { name?: unknown }).name : undefined;
  if (typeof name !== "string") {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "Field name wajib berupa string." },
      { status: 400 },
    );
  }

  try {
    const payload = await convex.mutation("workspaces:renameWorkspace", {
      workspaceId,
      name,
    });
    return Response.json(payload);
  } catch (error) {
    if (error instanceof ConvexError) {
      return convexErrorResponse(error, "Gagal mengubah nama workspace.");
    }
    return convexErrorResponse(error, "Gagal mengubah nama workspace.");
  }
}

export async function POST(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }
  const workspaceId = workspaceContext.workspace.workspaceId;

  const roleCheck = await requireWorkspaceRoleApiFromDb(["superadmin"], workspaceId);
  if ("error" in roleCheck) return roleCheck.error;

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ code: "UNAUTHENTICATED", message: "Unauthorized" }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ code: "INTERNAL_ERROR", message: "Convex URL missing" }, { status: 500 });
  }

  const restrictionResponse = await enforceWorkspaceRestriction(
    convex,
    workspaceId,
    roleCheck.session.role,
    "dashboard_overview",
  );
  if (restrictionResponse) {
    return restrictionResponse;
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

  const action = typeof body === "object" && body !== null ? (body as { action?: unknown }).action : undefined;
  if (
    action !== "rotateInviteCode" &&
    action !== "deleteWorkspace" &&
    action !== "updateInviteExpiry"
  ) {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "Action tidak valid." },
      { status: 400 },
    );
  }

  const expiryPreset =
    typeof body === "object" && body !== null
      ? (body as { expiryPreset?: unknown }).expiryPreset
      : undefined;

  if (
    action === "updateInviteExpiry" &&
    expiryPreset !== "never" &&
    expiryPreset !== "1d" &&
    expiryPreset !== "7d" &&
    expiryPreset !== "30d"
  ) {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "Field expiryPreset wajib berupa preset yang valid." },
      { status: 400 },
    );
  }

  try {
    const payload =
      action === "deleteWorkspace"
        ? await convex.mutation("workspaces:deleteWorkspace", {
            workspaceId,
          })
        : action === "updateInviteExpiry"
          ? await convex.mutation("workspaces:updateActiveInviteExpiry", {
              workspaceId,
              expiryPreset,
            })
        : await convex.mutation("workspaces:rotateWorkspaceInviteCode", {
            workspaceId,
          });
    return Response.json(payload);
  } catch (error) {
    if (error instanceof ConvexError) {
      return convexErrorResponse(
        error,
        action === "deleteWorkspace"
          ? "Gagal menghapus workspace."
          : action === "updateInviteExpiry"
            ? "Gagal memperbarui masa berlaku invitation code."
          : "Gagal merotasi invitation code.",
      );
    }
    return convexErrorResponse(
      error,
      action === "deleteWorkspace"
        ? "Gagal menghapus workspace."
        : action === "updateInviteExpiry"
          ? "Gagal memperbarui masa berlaku invitation code."
        : "Gagal merotasi invitation code.",
    );
  }
}
