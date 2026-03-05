import { beforeEach, describe, expect, it, vi } from "vitest";

type RoleResult = { error: Response } | { session: { role: string } };

type CommonSetupOptions = {
  roleResult?: RoleResult;
  convexToken?: string | null;
  convexClient?: {
    query?: ReturnType<typeof vi.fn>;
    mutation?: ReturnType<typeof vi.fn>;
  } | null;
  workspaceContext?: { error: Response } | { workspace: { workspaceId: string } };
};

function buildWorkspaceContextMock(options: CommonSetupOptions) {
  return vi.fn(() => {
    if (options.workspaceContext) {
      return options.workspaceContext;
    }
    return {
      workspace: { workspaceId: "workspace_123456" },
    };
  });
}

async function setupDeviceQrTokenRoute(options: CommonSetupOptions = {}) {
  vi.resetModules();

  const requireWorkspaceRoleApiFromDb = vi.fn(
    async () => options.roleResult ?? { session: { role: "device-qr" } },
  );
  const getConvexTokenOrNull = vi.fn(async () =>
    options.convexToken === undefined ? "convex-token" : options.convexToken,
  );
  const mutation =
    options.convexClient?.mutation ??
    vi.fn(async () => ({ token: "issued-token", expiresAt: 12345 }));
  const getAuthedConvexHttpClient = vi.fn(() =>
    options.convexClient === null ? null : { mutation },
  );

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceRoleApiFromDb,
    getConvexTokenOrNull,
    requireWorkspaceApiContext: buildWorkspaceContextMock(options),
  }));
  vi.doMock("@/lib/convex-http", () => ({
    getAuthedConvexHttpClient,
  }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json(
        {
          code: "INTERNAL_ERROR",
          message: fallbackMessage,
        },
        { status: 500 },
      ),
    ),
  }));

  const routeModule = await import("../app/api/device/qr-token/route");
  return {
    GET: routeModule.GET,
    mocks: {
      requireWorkspaceRoleApiFromDb,
      getConvexTokenOrNull,
      getAuthedConvexHttpClient,
      mutation,
    },
  };
}

async function setupAdminSettingsRoute(options: CommonSetupOptions = {}) {
  vi.resetModules();

  const requireWorkspaceRoleApiFromDb = vi.fn(
    async () => options.roleResult ?? { session: { role: "superadmin" } },
  );
  const getConvexTokenOrNull = vi.fn(async () =>
    options.convexToken === undefined ? "convex-token" : options.convexToken,
  );
  const mutation = options.convexClient?.mutation ?? vi.fn(async () => null);
  const query =
    options.convexClient?.query ??
    vi.fn(async () => ({
      timezone: "Asia/Jakarta",
      geofenceEnabled: false,
      geofenceRadiusMeters: 100,
      whitelistEnabled: false,
      whitelistIps: [],
    }));
  const getAuthedConvexHttpClient = vi.fn(() =>
    options.convexClient === null
      ? null
      : {
          query,
          mutation,
        },
  );

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceRoleApiFromDb,
    getConvexTokenOrNull,
    requireWorkspaceApiContext: buildWorkspaceContextMock(options),
  }));
  vi.doMock("@/lib/convex-http", () => ({
    getAuthedConvexHttpClient,
  }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json(
        {
          code: "INTERNAL_ERROR",
          message: fallbackMessage,
        },
        { status: 500 },
      ),
    ),
  }));

  const routeModule = await import("../app/api/admin/settings/route");
  return {
    GET: routeModule.GET,
    PATCH: routeModule.PATCH,
    mocks: {
      requireWorkspaceRoleApiFromDb,
      getConvexTokenOrNull,
      getAuthedConvexHttpClient,
      query,
      mutation,
    },
  };
}

describe("security auth and rbac routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns workspace required when workspace context is missing", async () => {
    const missingWorkspace = Response.json(
      { code: "WORKSPACE_REQUIRED", message: "Missing x-workspace-id header" },
      { status: 400 },
    );
    const { GET, mocks } = await setupDeviceQrTokenRoute({
      workspaceContext: { error: missingWorkspace },
    });

    const response = await GET(
      new Request("http://localhost/api/device/qr-token", { method: "GET" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "WORKSPACE_REQUIRED",
      message: "Missing x-workspace-id header",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("denies /api/device/qr-token when role check fails", async () => {
    const denied = Response.json(
      { code: "FORBIDDEN", message: "Forbidden" },
      { status: 403 },
    );
    const { GET, mocks } = await setupDeviceQrTokenRoute({
      roleResult: { error: denied },
    });

    const response = await GET(
      new Request("http://localhost/api/device/qr-token", { method: "GET" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "FORBIDDEN",
      message: "Forbidden",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("allows /api/device/qr-token for device-qr role", async () => {
    const { GET, mocks } = await setupDeviceQrTokenRoute();

    const response = await GET(
      new Request("http://localhost/api/device/qr-token", { method: "GET" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      token: "issued-token",
      expiresAt: 12345,
    });
    expect(mocks.mutation).toHaveBeenCalledWith("qrTokens:issue", {
      workspaceId: "workspace_123456",
    });
  });

  it("denies /api/admin/settings when role is not superadmin", async () => {
    const denied = Response.json(
      { code: "FORBIDDEN", message: "Forbidden" },
      { status: 403 },
    );
    const { GET, mocks } = await setupAdminSettingsRoute({
      roleResult: { error: denied },
    });

    const response = await GET(
      new Request("http://localhost/api/admin/settings", { method: "GET" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "FORBIDDEN",
      message: "Forbidden",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("returns 401 on /api/admin/settings when convex token is missing", async () => {
    const { GET, mocks } = await setupAdminSettingsRoute({ convexToken: null });

    const response = await GET(
      new Request("http://localhost/api/admin/settings", { method: "GET" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "UNAUTHENTICATED",
      message: "Unauthorized",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("loads settings for superadmin using ensureGlobal + get", async () => {
    const { GET, mocks } = await setupAdminSettingsRoute();

    const response = await GET(
      new Request("http://localhost/api/admin/settings", { method: "GET" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.mutation).toHaveBeenCalledWith("settings:ensureGlobal", {
      workspaceId: "workspace_123456",
    });
    expect(mocks.query).toHaveBeenCalledWith("settings:get", {
      workspaceId: "workspace_123456",
    });
  });

  it("updates settings via PATCH for superadmin", async () => {
    const mutation = vi.fn(async () => null);
    const { PATCH } = await setupAdminSettingsRoute({
      convexClient: { mutation, query: vi.fn() },
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          timezone: "Asia/Jakarta",
          geofenceEnabled: true,
          geofenceRadiusMeters: 150,
          geofenceLat: -6.2,
          geofenceLng: 106.8,
          whitelistEnabled: true,
          whitelistIps: ["203.0.113.1"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mutation).toHaveBeenCalledWith("settings:update", {
      workspaceId: "workspace_123456",
      timezone: "Asia/Jakarta",
      geofenceEnabled: true,
      geofenceRadiusMeters: 150,
      geofenceLat: -6.2,
      geofenceLng: 106.8,
      whitelistEnabled: true,
      whitelistIps: ["203.0.113.1"],
    });
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
