import { cookies } from "next/headers";

import { getConvexTokenOrNull } from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace-context";

type MembershipsResponse = {
  hasActiveMembership: boolean;
  memberships: Array<{
    membershipId: string;
    role: "superadmin" | "admin" | "karyawan" | "device-qr";
    isActive: boolean;
    workspace: {
      _id: string;
      name: string;
      slug: string;
      isActive: boolean;
    };
  }>;
};

export async function GET() {
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
    const payload = await convex.query<MembershipsResponse>(
      "workspaces:myOnboardingState",
      {},
    );
    const cookieStore = await cookies();
    const activeFromCookie = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
    const activeWorkspaceId =
      payload.memberships.find((item) => item.workspace._id === activeFromCookie)
        ?.workspace._id ??
      payload.memberships[0]?.workspace._id ??
      null;

    return Response.json({
      ...payload,
      activeWorkspaceId,
    });
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat daftar workspace.");
  }
}
