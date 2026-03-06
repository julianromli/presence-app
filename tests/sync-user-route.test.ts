import { beforeEach, describe, expect, it, vi } from "vitest";

async function setupRoute(options?: {
  userId?: string | null;
  token?: string | null;
  syncResponse?: Response | null;
}) {
  vi.resetModules();

  const syncCurrentUserToConvex = vi.fn(async () =>
    options?.syncResponse === undefined ? null : options.syncResponse,
  );

  vi.doMock("@clerk/nextjs/server", () => ({
    auth: vi.fn(async () => ({
      userId: options?.userId === undefined ? "clerk_u1" : options.userId,
    })),
  }));
  vi.doMock("@/lib/auth", () => ({
    getConvexTokenOrNull: vi.fn(async () =>
      options?.token === undefined ? "convex-token" : options.token,
    ),
  }));
  vi.doMock("@/lib/user-sync", () => ({ syncCurrentUserToConvex }));

  const routeModule = await import("../app/api/sync-user/route");
  return { POST: routeModule.POST, mocks: { syncCurrentUserToConvex } };
}

describe("sync user route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates user bootstrap to the shared sync helper", async () => {
    const { POST, mocks } = await setupRoute();

    const response = await POST();

    expect(response.status).toBe(200);
    expect(mocks.syncCurrentUserToConvex).toHaveBeenCalledWith("convex-token");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns the helper response when shared sync fails", async () => {
    const { POST, mocks } = await setupRoute({
      syncResponse: Response.json(
        { code: "NOT_FOUND", message: "User not found" },
        { status: 404 },
      ),
    });

    const response = await POST();

    expect(mocks.syncCurrentUserToConvex).toHaveBeenCalledWith("convex-token");
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "User not found",
    });
  });
});
