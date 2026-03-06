import { beforeEach, describe, expect, it, vi } from "vitest";

async function setupRoute(options?: {
  token?: string | null;
  convexClient?: { query: ReturnType<typeof vi.fn> } | null;
  syncResponse?: Response | null;
}) {
  vi.resetModules();

  const query =
    options?.convexClient?.query ??
    vi.fn(async () => ({
      hasActiveMembership: false,
      memberships: [],
    }));
  const getAuthedConvexHttpClient = vi.fn(() =>
    options?.convexClient === null ? null : { query },
  );
  const ensureCurrentUserInConvex = vi.fn(async () =>
    options?.syncResponse === undefined ? null : options.syncResponse,
  );

  vi.doMock("@/lib/auth", () => ({
    getConvexTokenOrNull: vi.fn(async () =>
      options?.token === undefined ? "convex-token" : options.token,
    ),
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/user-sync", () => ({ ensureCurrentUserInConvex }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/workspaces/onboarding/route");
  return { GET: routeModule.GET, mocks: { query, ensureCurrentUserInConvex, getAuthedConvexHttpClient } };
}

describe("workspaces onboarding route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ensures the current user exists before loading onboarding state", async () => {
    const { GET, mocks } = await setupRoute();

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.ensureCurrentUserInConvex).toHaveBeenCalledWith("convex-token");
    expect(mocks.query).toHaveBeenCalledWith("workspaces:myOnboardingState", {});
  });

  it("returns the sync response immediately when user bootstrap fails", async () => {
    const syncResponse = Response.json(
      { code: "NOT_FOUND", message: "User not found" },
      { status: 404 },
    );
    const { GET, mocks } = await setupRoute({ syncResponse });

    const response = await GET();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "User not found",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
