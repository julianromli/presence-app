import { getConvexTokenOrNull } from "@/lib/auth";
import { convexErrorResponse } from "@/lib/api-error";
import { getAuthedConvexHttpClient } from "@/lib/convex-http";
import { ensureCurrentUserInConvex } from "@/lib/user-sync";

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
    const syncResponse = await ensureCurrentUserInConvex(token);
    if (syncResponse) {
      return syncResponse;
    }

    const state = await convex.query("workspaces:myOnboardingState", {});
    return Response.json(state);
  } catch (error) {
    return convexErrorResponse(error, "Gagal memuat status onboarding workspace.");
  }
}
