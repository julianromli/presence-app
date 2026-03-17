import { beforeEach, describe, expect, it, vi } from "vitest";

type RoleResult = { error: Response } | { session: { role: string } };
type WorkspaceContextResult =
  | { error: Response }
  | { workspace: { workspaceId: string } };

type SetupOptions = {
  roleResult?: RoleResult;
  convexToken?: string | null;
  workspaceContext?: WorkspaceContextResult;
  mutationImpl?: ReturnType<typeof vi.fn>;
  queryImpl?: ReturnType<typeof vi.fn>;
};

async function setupRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const requireWorkspaceRoleApiFromDb = vi.fn(
    async () => options.roleResult ?? { session: { role: "admin" } },
  );
  const requireWorkspaceApiContext = vi.fn(
    () => options.workspaceContext ?? { workspace: { workspaceId: "workspace_123456" } },
  );
  const getConvexTokenOrNull = vi.fn(async () =>
    options.convexToken === undefined ? "convex-token" : options.convexToken,
  );
  const mutation = options.mutationImpl ?? vi.fn(async () => null);
  const query =
    options.queryImpl ??
    vi.fn(async () => ({
      totals: { employees: 10 },
      today: { checkedIn: 8 },
    }));
  const getAuthedConvexHttpClient = vi.fn(() => ({ mutation, query }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceRoleApiFromDb,
    requireWorkspaceApiContext,
    getConvexTokenOrNull,
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/admin/dashboard/overview/route");
  return {
    GET: routeModule.GET,
    mocks: {
      mutation,
      query,
    },
  };
}

describe("admin dashboard overview route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when convex token is missing", async () => {
    const { GET, mocks } = await setupRoute({ convexToken: null });

    const response = await GET(new Request("http://localhost/api/admin/dashboard/overview"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "UNAUTHENTICATED",
      message: "Unauthorized",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("ensures settings before loading overview payload", async () => {
    const { GET, mocks } = await setupRoute();

    const response = await GET(new Request("http://localhost/api/admin/dashboard/overview"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      totals: { employees: 10 },
      today: { checkedIn: 8 },
    });
    expect(mocks.mutation).toHaveBeenCalledWith("settings:ensureGlobal", {
      workspaceId: "workspace_123456",
    });
    expect(mocks.query).toHaveBeenCalledWith("dashboard:getOverview", {
      workspaceId: "workspace_123456",
    });
  });
});
