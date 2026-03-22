import { beforeEach, describe, expect, it, vi } from "vitest";

type RoleResult = { error: Response } | { session: { role: string } };

type SetupOptions = {
  roleResult?: RoleResult;
  workspaceContext?: { error: Response } | { workspace: { workspaceId: string } };
  mutationImpl?: ReturnType<typeof vi.fn>;
  useActualApiError?: boolean;
  restrictionResponse?: Response | null;
  restrictionHandler?: (action: string) => Response | null;
};

function expectResponse(value: Response | undefined) {
  expect(value).toBeDefined();
  return value as Response;
}

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
  const enforceWorkspaceRestriction = vi.fn(async (_convex, _workspaceId, _role, action: string) =>
    options.restrictionHandler?.(action) ?? options.restrictionResponse ?? null,
  );

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    requireWorkspaceRoleApiFromDb: vi.fn(
      async () => options.roleResult ?? { session: { role: "admin" } },
    ),
    getConvexTokenOrNull: vi.fn(async () => "convex-token"),
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/workspace-restriction-guard", () => ({
    enforceWorkspaceRestriction,
  }));
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
  const mutation = options.mutationImpl ?? vi.fn(async () => ({ ok: true }));
  const getAuthedConvexHttpClient = vi.fn(() => ({ query, mutation }));
  const parseUsersPatchBody = vi.fn<() => { userId: string; role?: string; isActive?: boolean }>(() => ({
    userId: "user_target",
    isActive: true,
  }));
  const enforceWorkspaceRestriction = vi.fn(async (_convex, _workspaceId, _role, action: string) =>
    options.restrictionHandler?.(action) ?? options.restrictionResponse ?? null,
  );

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    requireWorkspaceRoleApiFromDb: vi.fn(
      async () => options.roleResult ?? { session: { role: "admin" } },
    ),
    getConvexTokenOrNull: vi.fn(async () => "convex-token"),
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/workspace-restriction-guard", () => ({
    enforceWorkspaceRestriction,
  }));
  vi.doMock("@/lib/admin-users", () => ({
    normalizeUsersListQuery: vi.fn(() => ({
      q: undefined,
      role: undefined,
      isActive: undefined,
      limit: 10,
      cursor: null,
    })),
    parseUsersPatchBody,
  }));
  if (options.useActualApiError) {
    const actualApiError = await vi.importActual<typeof import("../lib/api-error")>(
      "../lib/api-error",
    );
    vi.doMock("@/lib/api-error", () => ({
      convexErrorResponse: actualApiError.convexErrorResponse,
    }));
  } else {
    vi.doMock("@/lib/api-error", () => ({
      convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
        Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
      ),
    }));
  }

  const routeModule = await import("../app/api/admin/users/route");
  return {
    GET: routeModule.GET,
    PATCH: routeModule.PATCH,
    mocks: { mutation, parseUsersPatchBody, query },
  };
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

    const response = expectResponse(await GET(new Request("http://localhost/api/admin/reports")));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "WORKSPACE_REQUIRED",
      message: "Missing x-workspace-id header",
    });
  });

  it("passes strict workspaceId to reports query + action", async () => {
    const { GET, POST, mocks } = await setupReportsRoute();

    const listResponse = expectResponse(await GET(new Request("http://localhost/api/admin/reports")));
    expect(listResponse.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith("reports:listWeekly", {
      workspaceId: "workspace_123456",
    });

    const triggerResponse = expectResponse(
      await POST(new Request("http://localhost/api/admin/reports", { method: "POST" })),
    );
    expect(triggerResponse.status).toBe(200);
    expect(mocks.action).toHaveBeenCalledWith("reports:triggerWeeklyReport", {
      workspaceId: "workspace_123456",
    });
  });

  it("blocks admin report actions when workspace is restricted", async () => {
    const restricted = Response.json(
      {
        code: "WORKSPACE_RESTRICTED_EXPIRED",
        message:
          "Dashboard diblokir sampai workspace kembali patuh ke batas paket Free atau mengaktifkan paket berbayar lagi.",
      },
      { status: 409 },
    );
    const { GET, POST, mocks } = await setupReportsRoute({ restrictionResponse: restricted });

    const listResponse = expectResponse(await GET(new Request("http://localhost/api/admin/reports")));
    expect(listResponse.status).toBe(409);
    expect(mocks.query).not.toHaveBeenCalled();

    const postResponse = expectResponse(
      await POST(new Request("http://localhost/api/admin/reports", { method: "POST" })),
    );
    expect(postResponse.status).toBe(409);
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("returns 400 when workspace header is invalid on users route", async () => {
    const invalidWorkspace = Response.json(
      { code: "WORKSPACE_INVALID", message: "Invalid x-workspace-id header" },
      { status: 400 },
    );
    const { GET, mocks } = await setupUsersRoute({
      workspaceContext: { error: invalidWorkspace },
    });

    const response = expectResponse(
      await GET(new Request("http://localhost/api/admin/users?limit=10")),
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

    const response = expectResponse(
      await GET(new Request("http://localhost/api/admin/users?limit=10")),
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

  it("preserves PLAN_LIMIT_REACHED from the admin users PATCH route", async () => {
    const domainError = {
      data: {
        code: "PLAN_LIMIT_REACHED",
        message: "Jumlah member aktif sudah mencapai batas paket workspace Anda.",
      },
    };
    const { PATCH, mocks } = await setupUsersRoute({
      mutationImpl: vi.fn(async () => {
        throw domainError;
      }),
      roleResult: { session: { role: "superadmin" } },
      useActualApiError: true,
    });

    const response = expectResponse(
      await PATCH(
        new Request("http://localhost/api/admin/users", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: "user_target", isActive: true }),
        }),
      ),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "PLAN_LIMIT_REACHED",
      message: "Jumlah member aktif sudah mencapai batas paket workspace Anda.",
    });
    expect(mocks.parseUsersPatchBody).toHaveBeenCalled();
    expect(mocks.mutation).toHaveBeenCalledWith("users:updateAdminManagedFields", {
      workspaceId: "workspace_123456",
      userId: "user_target",
      role: undefined,
      isActive: true,
    });
  });

  it("blocks admin user listing when workspace is restricted", async () => {
    const restricted = Response.json(
      {
        code: "WORKSPACE_RESTRICTED_EXPIRED",
        message:
          "Dashboard diblokir sampai workspace kembali patuh ke batas paket Free atau mengaktifkan paket berbayar lagi.",
      },
      { status: 409 },
    );
    const { GET, mocks } = await setupUsersRoute({ restrictionResponse: restricted });

    const response = expectResponse(await GET(new Request("http://localhost/api/admin/users?limit=10")));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "WORKSPACE_RESTRICTED_EXPIRED",
      message:
        "Dashboard diblokir sampai workspace kembali patuh ke batas paket Free atau mengaktifkan paket berbayar lagi.",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("allows only member deactivation during restriction on users PATCH", async () => {
    const restricted = Response.json(
      {
        code: "WORKSPACE_RESTRICTED_EXPIRED",
        message:
          "Dashboard diblokir sampai workspace kembali patuh ke batas paket Free atau mengaktifkan paket berbayar lagi.",
      },
      { status: 409 },
    );
    const { PATCH, mocks } = await setupUsersRoute({
      roleResult: { session: { role: "superadmin" } },
      restrictionHandler: (action) => (action === "dashboard_overview" ? restricted : null),
    });

    const blockedResponse = expectResponse(
      await PATCH(
        new Request("http://localhost/api/admin/users", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: "user_target", role: "admin" }),
        }),
      ),
    );

    expect(blockedResponse.status).toBe(409);
    expect(mocks.mutation).not.toHaveBeenCalled();

    mocks.parseUsersPatchBody.mockReturnValueOnce({
      userId: "user_target",
      isActive: false,
    });

    const allowedResponse = expectResponse(
      await PATCH(
        new Request("http://localhost/api/admin/users", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: "user_target", isActive: false }),
        }),
      ),
    );

    expect(allowedResponse.status).toBe(200);
    expect(mocks.mutation).toHaveBeenCalledWith("users:updateAdminManagedFields", {
      workspaceId: "workspace_123456",
      userId: "user_target",
      role: undefined,
      isActive: false,
    });
  });

  it("treats deactivation with role changes as member recovery during restriction", async () => {
    const restricted = Response.json(
      {
        code: "WORKSPACE_RESTRICTED_EXPIRED",
        message:
          "Dashboard diblokir sampai workspace kembali patuh ke batas paket Free atau mengaktifkan paket berbayar lagi.",
      },
      { status: 409 },
    );
    const { PATCH, mocks } = await setupUsersRoute({
      roleResult: { session: { role: "superadmin" } },
      restrictionHandler: (action) => (action === "dashboard_overview" ? restricted : null),
    });

    mocks.parseUsersPatchBody.mockReturnValueOnce({
      userId: "user_target",
      role: "admin",
      isActive: false,
    });

    const response = expectResponse(
      await PATCH(
        new Request("http://localhost/api/admin/users", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: "user_target", role: "admin", isActive: false }),
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.mutation).toHaveBeenCalledWith("users:updateAdminManagedFields", {
      workspaceId: "workspace_123456",
      userId: "user_target",
      role: "admin",
      isActive: false,
    });
  });
});
