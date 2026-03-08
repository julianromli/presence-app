import { beforeEach, describe, expect, it, vi } from "vitest";

type SetupOptions = {
  workspaceContext?: { error: Response } | { workspace: { workspaceId: string } };
};

function makeWorkspaceContext(options: SetupOptions) {
  if (options.workspaceContext) {
    return options.workspaceContext;
  }
  return { workspace: { workspaceId: "workspace_123456" } };
}

async function setupReadRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const query = vi.fn(async () => null);
  const mutation = vi.fn(async () => ({
    ok: true,
    unreadCount: 0,
  }));
  const getAuthedConvexHttpClient = vi.fn(() => ({ query, mutation }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    requireWorkspaceRoleApiFromDb: vi.fn(async () => ({ session: { role: "karyawan" } })),
    getConvexTokenOrNull: vi.fn(async () => "convex-token"),
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/karyawan/notifications/read/route");
  return { POST: routeModule.POST, mocks: { mutation } };
}

async function setupReadAllRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const query = vi.fn(async () => null);
  const mutation = vi.fn(async () => ({
    ok: true,
    unreadCount: 0,
  }));
  const getAuthedConvexHttpClient = vi.fn(() => ({ query, mutation }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    requireWorkspaceRoleApiFromDb: vi.fn(async () => ({ session: { role: "karyawan" } })),
    getConvexTokenOrNull: vi.fn(async () => "convex-token"),
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/karyawan/notifications/read-all/route");
  return { POST: routeModule.POST, mocks: { mutation } };
}

describe("karyawan notifications routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 for invalid JSON in mark-all-read route", async () => {
    const { POST, mocks } = await setupReadAllRoute();

    const response = await POST(
      new Request("http://localhost/api/karyawan/notifications/read-all", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "BAD_REQUEST",
      message: "Payload JSON tidak valid.",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("allows an empty body in mark-all-read route", async () => {
    const { POST, mocks } = await setupReadAllRoute();

    const response = await POST(
      new Request("http://localhost/api/karyawan/notifications/read-all", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.mutation).toHaveBeenCalledWith("notifications:markAllRead", {
      workspaceId: "workspace_123456",
      beforeTs: undefined,
    });
  });

  it("returns 400 when mark-read payload is null JSON", async () => {
    const { POST, mocks } = await setupReadRoute();

    const response = await POST(
      new Request("http://localhost/api/karyawan/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "null",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION_ERROR",
      message: "Payload JSON harus berupa object.",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("trims notificationId before calling mark-read mutation", async () => {
    const { POST, mocks } = await setupReadRoute();

    const response = await POST(
      new Request("http://localhost/api/karyawan/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notificationId: "  notif_123  " }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.mutation).toHaveBeenCalledWith("notifications:markRead", {
      workspaceId: "workspace_123456",
      notificationId: "notif_123",
    });
  });
});
