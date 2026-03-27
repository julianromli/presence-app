import { beforeEach, describe, expect, it, vi } from "vitest";

type SetupOptions = {
  convexToken?: string | null;
  queryImpl?: ReturnType<typeof vi.fn>;
  mutationImpl?: ReturnType<typeof vi.fn>;
  useActualApiError?: boolean;
};

async function setupActiveRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const getConvexTokenOrNull = vi.fn(async () =>
    options.convexToken === undefined ? "convex-token" : options.convexToken,
  );
  const query =
    options.queryImpl ??
    vi.fn(async () => ({
      memberships: [
        { workspace: { _id: "workspace_123456" } },
      ],
    }));
  const getAuthedConvexHttpClient = vi.fn(() => ({ query }));

  vi.doMock("@/lib/auth", () => ({
    getConvexTokenOrNull,
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/workspaces/active/route");
  return { POST: routeModule.POST, mocks: { query } };
}

async function setupCreateRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const getConvexTokenOrNull = vi.fn(async () =>
    options.convexToken === undefined ? "convex-token" : options.convexToken,
  );
  const mutation =
    options.mutationImpl ??
    vi.fn(async () => ({
      workspaceId: "workspace_created",
    }));
  const getAuthedConvexHttpClient = vi.fn(() => ({ mutation }));

  vi.doMock("@/lib/auth", () => ({
    getConvexTokenOrNull,
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  if (options.useActualApiError) {
    const actualApiError = await vi.importActual<typeof import("../lib/api-error")>(
      "../lib/api-error"
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

  const routeModule = await import("../app/api/workspaces/create/route");
  return { POST: routeModule.POST, mocks: { mutation } };
}

async function setupJoinRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const getConvexTokenOrNull = vi.fn(async () =>
    options.convexToken === undefined ? "convex-token" : options.convexToken,
  );
  const mutation =
    options.mutationImpl ??
    vi.fn(async () => ({
      workspaceId: "workspace_joined",
    }));
  const getAuthedConvexHttpClient = vi.fn(() => ({ mutation }));

  vi.doMock("@/lib/auth", () => ({
    getConvexTokenOrNull,
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  if (options.useActualApiError) {
    const actualApiError = await vi.importActual<typeof import("../lib/api-error")>(
      "../lib/api-error"
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

  const routeModule = await import("../app/api/workspaces/join/route");
  return { POST: routeModule.POST, mocks: { mutation } };
}

describe("workspace lifecycle routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("active route rejects malformed JSON payloads", async () => {
    const { POST, mocks } = await setupActiveRoute();

    const response = await POST(
      new Request("http://localhost/api/workspaces/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{invalid-json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "BAD_REQUEST",
      message: "Payload JSON tidak valid.",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("active route forbids switching to a workspace outside membership", async () => {
    const { POST, mocks } = await setupActiveRoute({
      queryImpl: vi.fn(async () => ({
        memberships: [{ workspace: { _id: "workspace_other" } }],
      })),
    });

    const response = await POST(
      new Request("http://localhost/api/workspaces/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: "workspace_123456" }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "FORBIDDEN",
      message: "Anda bukan anggota workspace ini.",
    });
    expect(mocks.query).toHaveBeenCalledWith("workspaces:myOnboardingState", {});
  });

  it("active route sets the workspace cookie after a successful switch", async () => {
    const { POST } = await setupActiveRoute();

    const response = await POST(
      new Request("http://localhost/api/workspaces/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: "workspace_123456" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      workspaceId: "workspace_123456",
    });
    expect(response.headers.get("set-cookie")).toContain("active_workspace_id=workspace_123456");
  });

  it("create route rejects non-string workspace names", async () => {
    const { POST, mocks } = await setupCreateRoute();

    const response = await POST(
      new Request("http://localhost/api/workspaces/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: 123 }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION_ERROR",
      message: "Field name wajib berupa string.",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("create route forwards the validated name to convex", async () => {
    const { POST, mocks } = await setupCreateRoute();

    const response = await POST(
      new Request("http://localhost/api/workspaces/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Presence Ops" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      workspaceId: "workspace_created",
    });
    expect(mocks.mutation).toHaveBeenCalledWith("workspaces:createWorkspace", {
      name: "Presence Ops",
    });
  });

  it("create route preserves non-plan domain errors from convex", async () => {
    const domainError = {
      data: {
        code: "VALIDATION_ERROR",
        message: "Workspace name minimal 3 karakter.",
      },
    };
    const { POST } = await setupCreateRoute({
      mutationImpl: vi.fn(async () => {
        throw domainError;
      }),
      useActualApiError: true,
    });

    const response = await POST(
      new Request("http://localhost/api/workspaces/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Presence Ops" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION_ERROR",
      message: "Workspace name minimal 3 karakter.",
    });
  });

  it("join route rejects non-string invitation codes", async () => {
    const { POST, mocks } = await setupJoinRoute();

    const response = await POST(
      new Request("http://localhost/api/workspaces/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: 42 }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION_ERROR",
      message: "Field code wajib berupa string.",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("join route forwards the validated code to convex", async () => {
    const { POST, mocks } = await setupJoinRoute();

    const response = await POST(
      new Request("http://localhost/api/workspaces/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "TEAM-7K4M-ABSENIN" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      workspaceId: "workspace_joined",
    });
    expect(mocks.mutation).toHaveBeenCalledWith("workspaces:joinWorkspaceByCode", {
      code: "TEAM-7K4M-ABSENIN",
    });
  });

  it("join route preserves the domain error code from convex", async () => {
    const domainError = {
      data: {
        code: "PLAN_LIMIT_REACHED",
        message: "Jumlah member aktif sudah mencapai batas paket workspace Anda.",
      },
    };
    const { POST } = await setupJoinRoute({
      mutationImpl: vi.fn(async () => {
        throw domainError;
      }),
      useActualApiError: true,
    });

    const response = await POST(
      new Request("http://localhost/api/workspaces/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "TEAM-7K4M-ABSENIN" }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "PLAN_LIMIT_REACHED",
      message: "Jumlah member aktif sudah mencapai batas paket workspace Anda.",
    });
  });
});
