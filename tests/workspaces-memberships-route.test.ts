import { beforeEach, describe, expect, it, vi } from "vitest";

type SetupOptions = {
  cookieValue?: string | null;
  memberships?: Array<{
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

async function setupMembershipsRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const payload = {
    hasActiveMembership: (options.memberships ?? []).length > 0,
    memberships: options.memberships ?? [],
  };

  const query = vi.fn(async () => payload);
  const ensureCurrentUserInConvex = vi.fn(async () => null);
  vi.doMock("@/lib/auth", () => ({
    getConvexTokenOrNull: vi.fn(async () => "convex-token"),
  }));
  vi.doMock("@/lib/convex-http", () => ({
    getAuthedConvexHttpClient: vi.fn(() => ({ query })),
  }));
  vi.doMock("@/lib/user-sync", () => ({
    ensureCurrentUserInConvex,
  }));
  vi.doMock("@/lib/workspace-context", () => ({
    ACTIVE_WORKSPACE_COOKIE: "active_workspace_id",
  }));
  vi.doMock("next/headers", () => ({
    cookies: vi.fn(async () => ({
      get: vi.fn(() =>
        options.cookieValue === undefined || options.cookieValue === null
          ? undefined
          : { value: options.cookieValue },
      ),
    })),
  }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const route = await import("../app/api/workspaces/memberships/route");
  return { GET: route.GET, mocks: { query, ensureCurrentUserInConvex } };
}

describe("workspaces memberships route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("auto-selects first workspace and sets cookie when cookie missing", async () => {
    const { GET, mocks } = await setupMembershipsRoute({
      memberships: [
        {
          membershipId: "m1",
          role: "admin",
          isActive: true,
          workspace: {
            _id: "workspace_123456",
            name: "Absenin.id HQ",
            slug: "absenin-id-hq",
            isActive: true,
          },
        },
      ],
    });

    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.ensureCurrentUserInConvex).toHaveBeenCalledWith("convex-token");
    await expect(response.json()).resolves.toMatchObject({
      activeWorkspaceId: "workspace_123456",
    });
    expect(response.headers.get("set-cookie")).toContain("active_workspace_id=workspace_123456");
  });

  it("falls back when cookie invalid and sets healed cookie", async () => {
    const { GET } = await setupMembershipsRoute({
      cookieValue: "invalid_cookie_id",
      memberships: [
        {
          membershipId: "m1",
          role: "superadmin",
          isActive: true,
          workspace: {
            _id: "workspace_ABCDEF",
            name: "Absenin.id Core",
            slug: "absenin-id-core",
            isActive: true,
          },
        },
      ],
    });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      activeWorkspaceId: "workspace_ABCDEF",
    });
    expect(response.headers.get("set-cookie")).toContain("active_workspace_id=workspace_ABCDEF");
  });

  it("returns null activeWorkspaceId when no memberships", async () => {
    const { GET } = await setupMembershipsRoute({
      cookieValue: "workspace_stale",
      memberships: [],
    });

    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      activeWorkspaceId: null,
    });
    expect(response.headers.get("set-cookie")).toContain("active_workspace_id=;");
  });
});
