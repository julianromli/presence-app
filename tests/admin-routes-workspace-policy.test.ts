import { beforeEach, describe, expect, it, vi } from "vitest";

type RoleResult = { error: Response } | { session: { role: string } };

type SetupOptions = {
  roleResult?: RoleResult;
  workspaceContext?: { error: Response } | { workspace: { workspaceId: string } };
};

function makeWorkspaceContext(options: SetupOptions) {
  if (options.workspaceContext) {
    return options.workspaceContext;
  }
  return { workspace: { workspaceId: "workspace_123456" } };
}

async function setupReportsRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const query = vi.fn(async () => []);
  const action = vi.fn(async () => ({
    weekKey: "2026-03-02_2026-03-08",
    status: "success",
    skipped: false,
  }));
  const getAuthedConvexHttpClient = vi.fn(() => ({ query, action }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    requireWorkspaceRoleApiFromDb: vi.fn(
      async () => options.roleResult ?? { session: { role: "admin" } },
    ),
    getConvexTokenOrNull: vi.fn(async () => "convex-token"),
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/admin-users", () => ({
    normalizeUsersListQuery: vi.fn(() => ({
      q: undefined,
      role: undefined,
      isActive: undefined,
      limit: 10,
      cursor: null,
    })),
    parseUsersPatchBody: vi.fn(),
  }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/admin/reports/route");
  return { GET: routeModule.GET, POST: routeModule.POST, mocks: { query, action } };
}

async function setupUsersRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const query = vi.fn(async () => ({
    rowsPage: {
      page: [],
      continueCursor: "",
      isDone: true,
    },
    summary: { total: 0, active: 0, inactive: 0 },
  }));
  const getAuthedConvexHttpClient = vi.fn(() => ({ query }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    requireWorkspaceRoleApiFromDb: vi.fn(
      async () => options.roleResult ?? { session: { role: "admin" } },
    ),
    getConvexTokenOrNull: vi.fn(async () => "convex-token"),
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/admin/users/route");
  return { GET: routeModule.GET, mocks: { query } };
}

describe("admin route workspace policy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 when workspace header is missing on reports route", async () => {
    const missingWorkspace = Response.json(
      { code: "WORKSPACE_REQUIRED", message: "Missing x-workspace-id header" },
      { status: 400 },
    );
    const { GET } = await setupReportsRoute({
      workspaceContext: { error: missingWorkspace },
    });

    const response = await GET(new Request("http://localhost/api/admin/reports"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "WORKSPACE_REQUIRED",
      message: "Missing x-workspace-id header",
    });
  });

  it("passes strict workspaceId to reports query + action", async () => {
    const { GET, POST, mocks } = await setupReportsRoute();

    const listResponse = await GET(new Request("http://localhost/api/admin/reports"));
    expect(listResponse.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith("reports:listWeekly", {
      workspaceId: "workspace_123456",
    });

    const triggerResponse = await POST(
      new Request("http://localhost/api/admin/reports", { method: "POST" }),
    );
    expect(triggerResponse.status).toBe(200);
    expect(mocks.action).toHaveBeenCalledWith("reports:triggerWeeklyReport", {
      workspaceId: "workspace_123456",
    });
  });

  it("returns 400 when workspace header is invalid on users route", async () => {
    const invalidWorkspace = Response.json(
      { code: "WORKSPACE_INVALID", message: "Invalid x-workspace-id header" },
      { status: 400 },
    );
    const { GET, mocks } = await setupUsersRoute({
      workspaceContext: { error: invalidWorkspace },
    });

    const response = await GET(
      new Request("http://localhost/api/admin/users?limit=10"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "WORKSPACE_INVALID",
      message: "Invalid x-workspace-id header",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("passes strict workspaceId to users query", async () => {
    const { GET, mocks } = await setupUsersRoute();

    const response = await GET(
      new Request("http://localhost/api/admin/users?limit=10"),
    );
    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith("users:listPaginated", {
      workspaceId: "workspace_123456",
      q: undefined,
      role: undefined,
      isActive: undefined,
      paginationOpts: {
        numItems: 10,
        cursor: null,
      },
    });
  });
});
