import { beforeEach, describe, expect, it, vi } from "vitest";

type RoleResult = { error: Response } | { session: { role: string } };
type WorkspaceContextResult =
  | { error: Response }
  | { workspace: { workspaceId: string } };

type SetupOptions = {
  roleResult?: RoleResult;
  convexToken?: string | null;
  queryImpl?: ReturnType<typeof vi.fn>;
  workspaceContext?: WorkspaceContextResult;
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
  const query =
    options.queryImpl ??
    vi.fn(async () => ({
      url: "https://files.example.com/report.xlsx",
      fileName: "report.xlsx",
    }));
  const getAuthedConvexHttpClient = vi.fn(() => ({ query }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceRoleApiFromDb,
    requireWorkspaceApiContext,
    getConvexTokenOrNull,
  }));
  vi.doMock("@/lib/convex-http", () => ({
    getAuthedConvexHttpClient,
  }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/admin/reports/download/route");
  return {
    GET: routeModule.GET,
    mocks: {
      query,
      requireWorkspaceRoleApiFromDb,
      requireWorkspaceApiContext,
      getConvexTokenOrNull,
      getAuthedConvexHttpClient,
    },
  };
}

describe("admin reports download route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns validation error when reportId is missing", async () => {
    const { GET, mocks } = await setupRoute();

    const response = await GET(
      new Request("http://localhost/api/admin/reports/download", {
        headers: { "x-workspace-id": "workspace_123456" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION_ERROR",
      message: "reportId wajib diisi.",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("returns 401 when convex token is missing", async () => {
    const { GET, mocks } = await setupRoute({ convexToken: null });

    const response = await GET(
      new Request("http://localhost/api/admin/reports/download?reportId=report_123", {
        headers: { "x-workspace-id": "workspace_123456" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "UNAUTHENTICATED",
      message: "Unauthorized",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("returns 404 when report file is not available yet", async () => {
    const { GET, mocks } = await setupRoute({
      queryImpl: vi.fn(async () => ({
        url: undefined,
        fileName: "report.xlsx",
      })),
    });

    const response = await GET(
      new Request("http://localhost/api/admin/reports/download?reportId=report_123", {
        headers: { "x-workspace-id": "workspace_123456" },
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "File report belum tersedia",
    });
    expect(mocks.query).toHaveBeenCalledWith("reports:getDownloadUrl", {
      reportId: "report_123",
      workspaceId: "workspace_123456",
    });
  });

  it("redirects to the resolved download url on success", async () => {
    const { GET, mocks } = await setupRoute();

    const response = await GET(
      new Request("http://localhost/api/admin/reports/download?reportId=report_123", {
        headers: { "x-workspace-id": "workspace_123456" },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://files.example.com/report.xlsx");
    expect(mocks.query).toHaveBeenCalledWith("reports:getDownloadUrl", {
      reportId: "report_123",
      workspaceId: "workspace_123456",
    });
  });
});
