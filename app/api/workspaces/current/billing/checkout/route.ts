import {
  getConvexTokenOrNull,
  requireWorkspaceApiContext,
  requireWorkspaceRoleApiFromDb,
} from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import type { WorkspaceCheckoutPayload } from "@/types/dashboard";

export async function POST(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ("error" in workspaceContext) {
    return workspaceContext.error;
  }
  const workspaceId = workspaceContext.workspace.workspaceId;

  const roleCheck = await requireWorkspaceRoleApiFromDb(["superadmin"], workspaceId);
  if ("error" in roleCheck) {
    return roleCheck.error;
  }

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ code: "UNAUTHENTICATED", message: "Unauthorized" }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ code: "INTERNAL_ERROR", message: "Convex URL missing" }, { status: 500 });
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

  const billingPhone =
    typeof body === "object" && body !== null
      ? (body as { billingPhone?: unknown }).billingPhone
      : undefined;
  if (typeof billingPhone !== "string") {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "Field billingPhone wajib berupa string." },
      { status: 400 },
    );
  }

  const normalizedBillingPhone = billingPhone.trim();
  if (!normalizedBillingPhone) {
    return Response.json(
      { code: "VALIDATION_ERROR", message: "Field billingPhone wajib diisi." },
      { status: 400 },
    );
  }

  try {
    const payload = await convex.action<WorkspaceCheckoutPayload>(
      "workspaceBilling:createWorkspaceCheckout",
      { billingPhone: normalizedBillingPhone, workspaceId },
    );
    return Response.json(payload);
  } catch (error) {
    return convexErrorResponse(error, "Gagal membuat checkout workspace.");
  }
}
