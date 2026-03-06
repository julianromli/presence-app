import { currentUser } from "@clerk/nextjs/server";

import { getAuthedConvexHttpClient } from "@/lib/convex-http";

function buildUserIdentityPayload(user: Awaited<ReturnType<typeof currentUser>>) {
  return {
    name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "Unknown",
    email: user?.primaryEmailAddress?.emailAddress ?? `${user?.id}@unknown.local`,
  };
}

export async function syncCurrentUserToConvex(token: string) {
  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ message: "Convex URL missing, skip sync" }, { status: 200 });
  }

  const user = await currentUser();
  if (!user) {
    return Response.json({ code: "NOT_FOUND", message: "User not found" }, { status: 404 });
  }

  await convex.mutation("users:upsertFromClerk", buildUserIdentityPayload(user));
  return null;
}

export async function ensureCurrentUserInConvex(token: string) {
  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ message: "Convex URL missing, skip sync" }, { status: 200 });
  }

  const existingUser = await convex.query("users:me", {});
  if (existingUser) {
    return null;
  }

  return await syncCurrentUserToConvex(token);
}
