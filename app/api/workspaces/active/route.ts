import { NextResponse } from "next/server";

import { getConvexTokenOrNull } from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import {
  ACTIVE_WORKSPACE_COOKIE,
  isValidWorkspaceId,
} from "@/lib/workspace-context";

type MembershipsResponse = {
  memberships: Array<{
    workspace: {
      _id: string;
    };
  }>;
};

export async function POST(req: Request) {
  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json(
      { code: "UNAUTHENTICATED", message: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: { workspaceId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { code: "BAD_REQUEST", message: "Payload JSON tidak valid." },
      { status: 400 },
    );
  }

  const workspaceId = body.workspaceId?.trim();
  if (!workspaceId || !isValidWorkspaceId(workspaceId)) {
    return Response.json(
      { code: "WORKSPACE_INVALID", message: "Workspace tidak valid." },
      { status: 400 },
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
    const payload = await convex.query<MembershipsResponse>(
      "workspaces:myOnboardingState",
      {},
    );

    const membership = payload.memberships.find(
      (item) => item.workspace._id === workspaceId,
    );
    if (!membership) {
      return Response.json(
        { code: "FORBIDDEN", message: "Anda bukan anggota workspace ini." },
        { status: 403 },
      );
    }

    const response = NextResponse.json({ ok: true, workspaceId });
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
    return response;
  } catch (error) {
    return convexErrorResponse(error, "Gagal mengubah workspace aktif.");
  }
}
