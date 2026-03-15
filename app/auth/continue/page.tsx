import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { APP_ROLES, getConvexTokenOrNull, requireWorkspaceRolePageFromDb } from "@/lib/auth";
import { getRoleHomePath, sanitizePostAuthNextPath } from "@/lib/post-auth";
import { ensureCurrentUserInConvex } from "@/lib/user-sync";

type AuthContinuePageProps = {
  searchParams: Promise<{
    next?: string | string[] | undefined;
  }>;
};

export default async function AuthContinuePage({
  searchParams,
}: AuthContinuePageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const token = await getConvexTokenOrNull();
  if (token) {
    await ensureCurrentUserInConvex(token);
  }

  const session = await requireWorkspaceRolePageFromDb(APP_ROLES);
  const { next } = await searchParams;
  const nextPath = sanitizePostAuthNextPath(next);

  if (session.role === "admin" || session.role === "superadmin") {
    redirect(nextPath ?? getRoleHomePath(session.role));
  }

  redirect(getRoleHomePath(session.role));
}
