import { beforeEach, describe, expect, it, vi } from "vitest";

type WorkspaceContextResult =
  | { error: Response }
  | { workspace: { workspaceId: string } };

type DeviceApiResult =
  | { error: Response }
  | {
      workspace: { workspaceId: string };
      device: {
        deviceId: string;
        label: string;
        claimedAt: number;
      };
    };

type SetupOptions = {
  workspaceContext?: WorkspaceContextResult;
  deviceApiResult?: DeviceApiResult;
  queryImpl?: ReturnType<typeof vi.fn>;
  mutationImpl?: ReturnType<typeof vi.fn>;
  useActualApiError?: boolean;
};

async function setupValidateCodeRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const requireWorkspaceApiContext = vi.fn(() =>
    options.workspaceContext ?? { workspace: { workspaceId: "workspace_123456" } },
  );
  const mutation =
    options.queryImpl ??
    vi.fn(async () => ({ ok: false, message: "Kode tidak valid atau sudah tidak aktif." }));
  const getConvexHttpClient = vi.fn(() => ({ mutation }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext,
  }));
  vi.doMock("@/lib/convex-http", () => ({
    getConvexHttpClient,
    getPublicConvexHttpClient: getConvexHttpClient,
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

  const routeModule = await import("../app/api/device/bootstrap/validate-code/route");
  return { POST: routeModule.POST, mocks: { requireWorkspaceApiContext, mutation } };
}

async function setupClaimRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const requireWorkspaceApiContext = vi.fn(() =>
    options.workspaceContext ?? { workspace: { workspaceId: "workspace_123456" } },
  );
  const mutation =
    options.mutationImpl ??
    vi.fn(async () => ({
      deviceId: "device_123",
      label: "Front Desk Tablet",
      secret: "secret_456",
      claimedAt: 1_234_567_890,
    }));
  const getConvexHttpClient = vi.fn(() => ({ mutation }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext,
  }));
  vi.doMock("@/lib/convex-http", () => ({
    getConvexHttpClient,
    getPublicConvexHttpClient: getConvexHttpClient,
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

  const routeModule = await import("../app/api/device/bootstrap/claim/route");
  return { POST: routeModule.POST, mocks: { requireWorkspaceApiContext, mutation } };
}

async function setupAuthRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const requireWorkspaceDeviceApi = vi.fn(
    async () =>
      options.deviceApiResult ?? {
        workspace: { workspaceId: "workspace_123456" },
        device: {
          deviceId: "device_123",
          label: "Front Desk Tablet",
          claimedAt: 1_234_567_890,
        },
      },
  );

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceDeviceApi,
  }));

  const routeModule = await import("../app/api/device/auth/route");
  return { GET: routeModule.GET, mocks: { requireWorkspaceDeviceApi } };
}

describe("device bootstrap routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("validate-code rejects missing workspace header", async () => {
    const missingWorkspace = Response.json(
      { code: "WORKSPACE_REQUIRED", message: "Missing x-workspace-id header" },
      { status: 400 },
    );
    const { POST, mocks } = await setupValidateCodeRoute({
      workspaceContext: { error: missingWorkspace },
    });

    const response = await POST(
      new Request("http://localhost/api/device/bootstrap/validate-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "ABC-123" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "WORKSPACE_REQUIRED",
      message: "Missing x-workspace-id header",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("validate-code returns generic invalid response for bad code", async () => {
    const { POST, mocks } = await setupValidateCodeRoute();

    const response = await POST(
      new Request("http://localhost/api/device/bootstrap/validate-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "BAD-CODE" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Kode tidak valid atau sudah tidak aktif.",
    });
    expect(mocks.mutation).toHaveBeenCalledWith("devices:validateRegistrationCodePreview", {
      workspaceId: "workspace_123456",
      code: "BAD-CODE",
      rateLimitKey: undefined,
    });
  });

  it("claim returns visible device payload and sets a secure auth cookie", async () => {
    const { POST, mocks } = await setupClaimRoute();

    const response = await POST(
      new Request("http://localhost/api/device/bootstrap/claim", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-real-ip": "203.0.113.1",
          "user-agent": "Vitest Browser",
        },
        body: JSON.stringify({ code: "GOOD-CODE", label: "Front Desk Tablet" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deviceId: "device_123",
      label: "Front Desk Tablet",
      claimedAt: 1_234_567_890,
    });
    expect(response.headers.get("set-cookie")).toContain("absenin.id.deviceAuth=");
    expect(mocks.mutation).toHaveBeenCalledWith("devices:claimRegistrationCode", {
      workspaceId: "workspace_123456",
      code: "GOOD-CODE",
      label: "Front Desk Tablet",
      ipAddress: "203.0.113.1",
      userAgent: "Vitest Browser",
      rateLimitKey: "ip:203.0.113.1|ua:Vitest Browser",
    });
  });

  it("claim preserves PLAN_LIMIT_REACHED for device cap feedback", async () => {
    const domainError = {
      data: {
        code: "PLAN_LIMIT_REACHED",
        message: "Jumlah device aktif sudah mencapai batas paket workspace Anda.",
      },
    };
    const { POST, mocks } = await setupClaimRoute({
      mutationImpl: vi.fn(async () => {
        throw domainError;
      }),
      useActualApiError: true,
    });

    const response = await POST(
      new Request("http://localhost/api/device/bootstrap/claim", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-real-ip": "203.0.113.1",
          "user-agent": "Vitest Browser",
        },
        body: JSON.stringify({ code: "GOOD-CODE", label: "Front Desk Tablet" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "PLAN_LIMIT_REACHED",
      message: "Jumlah device aktif sudah mencapai batas paket workspace Anda.",
    });
    expect(mocks.mutation).toHaveBeenCalledWith("devices:claimRegistrationCode", {
      workspaceId: "workspace_123456",
      code: "GOOD-CODE",
      label: "Front Desk Tablet",
      ipAddress: "203.0.113.1",
      userAgent: "Vitest Browser",
      rateLimitKey: "ip:203.0.113.1|ua:Vitest Browser",
    });
  });

  it("auth accepts valid x-device-key", async () => {
    const { GET, mocks } = await setupAuthRoute();

    const response = await GET(
      new Request("http://localhost/api/device/auth", {
        method: "GET",
        headers: {
          "x-workspace-id": "workspace_123456",
          "x-device-key": "device_123.secret_456",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      device: {
        deviceId: "device_123",
        label: "Front Desk Tablet",
        claimedAt: 1_234_567_890,
      },
    });
    expect(mocks.requireWorkspaceDeviceApi).toHaveBeenCalled();
  });

  it("auth rejects revoked or unknown device secret", async () => {
    const denied = Response.json(
      { code: "DEVICE_UNAUTHORIZED", message: "Unauthorized device" },
      { status: 401 },
    );
    const { GET, mocks } = await setupAuthRoute({
      deviceApiResult: { error: denied },
    });

    const response = await GET(
      new Request("http://localhost/api/device/auth", {
        method: "GET",
        headers: {
          "x-workspace-id": "workspace_123456",
          "x-device-key": "device_123.bad_secret",
        },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "DEVICE_UNAUTHORIZED",
      message: "Unauthorized device",
    });
    expect(mocks.requireWorkspaceDeviceApi).toHaveBeenCalled();
  });

  it("auth preserves internal verification failures for retry handling", async () => {
    const internalError = Response.json(
      { code: "INTERNAL_ERROR", message: "Gagal memverifikasi device." },
      { status: 500 },
    );
    const { GET } = await setupAuthRoute({
      deviceApiResult: { error: internalError },
    });

    const response = await GET(
      new Request("http://localhost/api/device/auth", {
        method: "GET",
        headers: {
          "x-workspace-id": "workspace_123456",
          "x-device-key": "device_123.temporary_failure",
        },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "INTERNAL_ERROR",
      message: "Gagal memverifikasi device.",
    });
  });
});
