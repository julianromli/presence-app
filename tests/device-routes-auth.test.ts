import { beforeEach, describe, expect, it, vi } from "vitest";

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
  deviceApiResult?: DeviceApiResult;
  mutationImpl?: ReturnType<typeof vi.fn>;
  workspaceContext?: { error: Response } | { workspace: { workspaceId: string } };
};

async function setupQrTokenRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const requireWorkspaceApiContext = vi.fn(() =>
    options.workspaceContext ?? { workspace: { workspaceId: "workspace_123456" } },
  );
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
  const mutation =
    options.mutationImpl ??
    vi.fn(async () => ({
      token: "qr_token_123",
      expiresAt: 2_000_000,
      issuedAt: 1_999_000,
      ttlMs: 20_000,
      rotationIntervalMs: 5_000,
      serverTime: 1_999_000,
    }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext,
    requireWorkspaceDeviceApi,
  }));
  vi.doMock("@/lib/convex-http", () => ({
    getPublicConvexHttpClient: vi.fn(() => ({ mutation })),
  }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/device/qr-token/route");
  return { GET: routeModule.GET, mocks: { mutation, requireWorkspaceDeviceApi } };
}

async function setupPingRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const requireWorkspaceApiContext = vi.fn(() =>
    options.workspaceContext ?? { workspace: { workspaceId: "workspace_123456" } },
  );
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
  const mutation =
    options.mutationImpl ??
    vi.fn(async () => ({
      ok: true,
      lastSeenAt: 1_999_999,
    }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext,
    requireWorkspaceDeviceApi,
  }));
  vi.doMock("@/lib/convex-http", () => ({
    getPublicConvexHttpClient: vi.fn(() => ({ mutation })),
  }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/device/ping/route");
  return { POST: routeModule.POST, mocks: { mutation, requireWorkspaceDeviceApi } };
}

describe("device runtime routes auth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requires valid x-device-key for /api/device/qr-token", async () => {
    const denied = Response.json(
      { code: "DEVICE_UNAUTHORIZED", message: "Unauthorized device" },
      { status: 401 },
    );
    const { GET, mocks } = await setupQrTokenRoute({
      deviceApiResult: { error: denied },
    });

    const response = await GET(
      new Request("http://localhost/api/device/qr-token", {
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
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("requires valid x-device-key for /api/device/ping", async () => {
    const denied = Response.json(
      { code: "DEVICE_UNAUTHORIZED", message: "Unauthorized device" },
      { status: 401 },
    );
    const { POST, mocks } = await setupPingRoute({
      deviceApiResult: { error: denied },
    });

    const response = await POST(
      new Request("http://localhost/api/device/ping", {
        method: "POST",
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
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("revoked device gets rejected on the next request", async () => {
    const denied = Response.json(
      { code: "DEVICE_UNAUTHORIZED", message: "Unauthorized device" },
      { status: 401 },
    );
    const { GET } = await setupQrTokenRoute({
      deviceApiResult: { error: denied },
    });

    const response = await GET(
      new Request("http://localhost/api/device/qr-token", {
        method: "GET",
        headers: {
          "x-workspace-id": "workspace_123456",
          "x-device-key": "device_123.revoked_secret",
        },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "DEVICE_UNAUTHORIZED",
      message: "Unauthorized device",
    });
  });

  it("forwards ipAddress and userAgent to ping mutation", async () => {
    const { POST, mocks } = await setupPingRoute();

    const response = await POST(
      new Request("http://localhost/api/device/ping", {
        method: "POST",
        headers: {
          "x-workspace-id": "workspace_123456",
          "x-device-key": "device_123.secret_456",
          "x-forwarded-for": "203.0.113.1, 10.0.0.2",
          "user-agent": "Vitest Browser",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.mutation).toHaveBeenCalledWith("deviceHeartbeat:ping", {
      workspaceId: "workspace_123456",
      deviceId: "device_123",
      ipAddress: "203.0.113.1",
      userAgent: "Vitest Browser",
    });
  });
});
