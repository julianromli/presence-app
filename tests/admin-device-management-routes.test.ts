import { beforeEach, describe, expect, it, vi } from "vitest";

type RoleResult = { error: Response } | { session: { role: string } };

type SetupOptions = {
  roleResult?: RoleResult;
  mutationImpl?: ReturnType<typeof vi.fn>;
  queryImpl?: ReturnType<typeof vi.fn>;
  workspaceContext?: { error: Response } | { workspace: { workspaceId: string } };
  useActualApiError?: boolean;
};

function buildWorkspaceContext(options: SetupOptions) {
  return vi.fn(() =>
    options.workspaceContext ?? { workspace: { workspaceId: "workspace_123456" } },
  );
}

function buildCommonMocks(options: SetupOptions) {
  const requireWorkspaceRoleApiFromDb = vi.fn(
    async () => options.roleResult ?? { session: { role: "superadmin" } },
  );
  const getConvexTokenOrNull = vi.fn(async () => "convex-token");
  const mutation = options.mutationImpl ?? vi.fn(async () => ({ ok: true }));
  const query = options.queryImpl ?? vi.fn(async () => []);
  const getAuthedConvexHttpClient = vi.fn(() => ({ mutation, query }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext: buildWorkspaceContext(options),
    requireWorkspaceRoleApiFromDb,
    getConvexTokenOrNull,
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));

  return { mutation, query, requireWorkspaceRoleApiFromDb };
}

async function setupRegistrationCodesRoute(options: SetupOptions = {}) {
  vi.resetModules();
  const mocks = buildCommonMocks(options);
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
  const routeModule = await import("../app/api/admin/device/registration-codes/route");
  return { GET: routeModule.GET, POST: routeModule.POST, mocks };
}

async function setupDevicesRoute(options: SetupOptions = {}) {
  vi.resetModules();
  const mocks = buildCommonMocks(options);
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
  const routeModule = await import("../app/api/admin/device/devices/route");
  return { GET: routeModule.GET, mocks };
}

async function setupDeviceDetailRoute(options: SetupOptions = {}) {
  vi.resetModules();
  const mocks = buildCommonMocks(options);
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
  const routeModule = await import("../app/api/admin/device/devices/[deviceId]/route");
  return { PATCH: routeModule.PATCH, mocks };
}

describe("admin device management routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("only superadmin can generate registration code", async () => {
    const denied = Response.json(
      { code: "FORBIDDEN", message: "Forbidden" },
      { status: 403 },
    );
    const { POST, mocks } = await setupRegistrationCodesRoute({
      roleResult: { error: denied },
    });

    const response = await POST(
      new Request("http://localhost/api/admin/device/registration-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "FORBIDDEN",
      message: "Forbidden",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("admin read and write attempts are forbidden", async () => {
    const denied = Response.json(
      { code: "FORBIDDEN", message: "Forbidden" },
      { status: 403 },
    );
    const { GET, mocks: listMocks } = await setupDevicesRoute({
      roleResult: { error: denied },
    });
    const { PATCH, mocks: patchMocks } = await setupDeviceDetailRoute({
      roleResult: { error: denied },
    });

    const listResponse = await GET(
      new Request("http://localhost/api/admin/device/devices", {
        method: "GET",
        headers: { "x-workspace-id": "workspace_123456" },
      }),
    );
    expect(listResponse.status).toBe(403);
    expect(listMocks.query).not.toHaveBeenCalled();

    const patchResponse = await PATCH(
      new Request("http://localhost/api/admin/device/devices/device_123", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-workspace-id": "workspace_123456",
        },
        body: JSON.stringify({ label: "Renamed Device" }),
      }),
      { params: Promise.resolve({ deviceId: "device_123" }) },
    );
    expect(patchResponse.status).toBe(403);
    expect(patchMocks.mutation).not.toHaveBeenCalled();
  });

  it("rename works for active device", async () => {
    const mutation = vi.fn(async () => ({
      deviceId: "device_123",
      label: "Renamed Device",
      status: "active",
    }));
    const { PATCH } = await setupDeviceDetailRoute({ mutationImpl: mutation });

    const response = await PATCH(
      new Request("http://localhost/api/admin/device/devices/device_123", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-workspace-id": "workspace_123456",
        },
        body: JSON.stringify({ label: "Renamed Device" }),
      }),
      { params: Promise.resolve({ deviceId: "device_123" }) },
    );

    expect(response.status).toBe(200);
    expect(mutation).toHaveBeenCalledWith("devices:updateDevice", {
      workspaceId: "workspace_123456",
      deviceId: "device_123",
      label: "Renamed Device",
      revoke: undefined,
    });
  });

  it("preserves PLAN_LIMIT_REACHED from registration code creation", async () => {
    const domainError = {
      data: {
        code: "PLAN_LIMIT_REACHED",
        message: "Jumlah device aktif sudah mencapai batas paket workspace Anda.",
      },
    };
    const { POST, mocks } = await setupRegistrationCodesRoute({
      mutationImpl: vi.fn(async () => {
        throw domainError;
      }),
      useActualApiError: true,
    });

    const response = await POST(
      new Request("http://localhost/api/admin/device/registration-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ttlMs: 300000 }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "PLAN_LIMIT_REACHED",
      message: "Jumlah device aktif sudah mencapai batas paket workspace Anda.",
    });
    expect(mocks.mutation).toHaveBeenCalledWith("devices:createRegistrationCode", {
      workspaceId: "workspace_123456",
      ttlMs: 300000,
    });
  });

  it("revoke changes device status and blocks future auth", async () => {
    const mutation = vi.fn(async () => ({
      deviceId: "device_123",
      label: "Front Desk Tablet",
      status: "revoked",
    }));
    const { PATCH } = await setupDeviceDetailRoute({ mutationImpl: mutation });

    const response = await PATCH(
      new Request("http://localhost/api/admin/device/devices/device_123", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-workspace-id": "workspace_123456",
        },
        body: JSON.stringify({ revoke: true }),
      }),
      { params: Promise.resolve({ deviceId: "device_123" }) },
    );

    expect(response.status).toBe(200);
    expect(mutation).toHaveBeenCalledWith("devices:updateDevice", {
      workspaceId: "workspace_123456",
      deviceId: "device_123",
      label: undefined,
      revoke: true,
    });
    await expect(response.json()).resolves.toEqual({
      deviceId: "device_123",
      label: "Front Desk Tablet",
      status: "revoked",
    });
  });
});
