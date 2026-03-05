import { beforeEach, describe, expect, it, vi } from "vitest";

type RoleResult = { error: Response } | { session: { role: string } };

type SetupOptions = {
  roleResult?: RoleResult;
  convexToken?: string | null;
  workspaceContext?: { error: Response } | { workspace: { workspaceId: string } };
};

function makeWorkspaceContext(options: SetupOptions) {
  if (options.workspaceContext) {
    return options.workspaceContext;
  }
  return { workspace: { workspaceId: "workspace_123456" } };
}

async function setupWorkspaceRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const query = vi.fn(async () => ({
    workspace: {
      _id: "workspace_123456",
      _creationTime: 1,
      slug: "presence-hq",
      name: "Presence HQ",
      isActive: true,
      createdAt: 1000,
      updatedAt: 2000,
      createdByUserId: "user_1",
    },
    activeInviteCode: {
      _id: "invite_1",
      code: "PRESENCE-ABC123-PRESENCE",
      isActive: true,
      createdAt: 1000,
      updatedAt: 2000,
      lastRotatedAt: 2000,
    },
  }));
  const mutation = vi.fn(async () => ({ ok: true }));
  const getAuthedConvexHttpClient = vi.fn(() => ({ query, mutation }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    requireWorkspaceRoleApiFromDb: vi.fn(
      async () => options.roleResult ?? { session: { role: "superadmin" } },
    ),
    getConvexTokenOrNull: vi.fn(async () =>
      options.convexToken === undefined ? "convex-token" : options.convexToken,
    ),
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/admin/workspace/route");
  return {
    GET: routeModule.GET,
    PATCH: routeModule.PATCH,
    POST: routeModule.POST,
    mocks: { query, mutation },
  };
}

describe("admin workspace route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns forbidden when role check fails", async () => {
    const forbidden = Response.json({ code: "FORBIDDEN", message: "Forbidden" }, { status: 403 });
    const { GET, mocks } = await setupWorkspaceRoute({
      roleResult: { error: forbidden },
    });

    const response = await GET(new Request("http://localhost/api/admin/workspace"));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ code: "FORBIDDEN", message: "Forbidden" });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("returns contract payload on GET and queries workspace detail", async () => {
    const { GET, mocks } = await setupWorkspaceRoute();
    const response = await GET(new Request("http://localhost/api/admin/workspace"));

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith("workspaces:workspaceManagementDetail", {
      workspaceId: "workspace_123456",
    });
    const payload = await response.json();
    expect(payload.workspace.slug).toBe("presence-hq");
    expect(payload.activeInviteCode.code).toBe("PRESENCE-ABC123-PRESENCE");
  });

  it("returns 401 when token missing", async () => {
    const { GET, mocks } = await setupWorkspaceRoute({ convexToken: null });
    const response = await GET(new Request("http://localhost/api/admin/workspace"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "UNAUTHENTICATED",
      message: "Unauthorized",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("validates PATCH body name", async () => {
    const { PATCH, mocks } = await setupWorkspaceRoute();
    const response = await PATCH(
      new Request("http://localhost/api/admin/workspace", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION_ERROR",
      message: "Field name wajib berupa string.",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("calls rename mutation on PATCH", async () => {
    const { PATCH, mocks } = await setupWorkspaceRoute();
    const response = await PATCH(
      new Request("http://localhost/api/admin/workspace", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Presence New Name" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.mutation).toHaveBeenCalledWith("workspaces:renameWorkspace", {
      workspaceId: "workspace_123456",
      name: "Presence New Name",
    });
  });

  it("validates POST action for rotate", async () => {
    const { POST, mocks } = await setupWorkspaceRoute();
    const response = await POST(
      new Request("http://localhost/api/admin/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "invalid" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION_ERROR",
      message: "Action tidak valid.",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("calls rotate mutation on POST", async () => {
    const { POST, mocks } = await setupWorkspaceRoute();
    const response = await POST(
      new Request("http://localhost/api/admin/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "rotateInviteCode" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.mutation).toHaveBeenCalledWith("workspaces:rotateWorkspaceInviteCode", {
      workspaceId: "workspace_123456",
    });
  });
});
