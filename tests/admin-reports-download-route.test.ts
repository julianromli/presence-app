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
  useActualApiError?: boolean;
  restrictionResponse?: Response | null;
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
  const enforceWorkspaceRestriction = vi.fn(async () => options.restrictionResponse ?? null);

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceRoleApiFromDb,
    requireWorkspaceApiContext,
    getConvexTokenOrNull,
  }));
  vi.doMock("@/lib/convex-http", () => ({
    getAuthedConvexHttpClient,
  }));
  vi.doMock("@/lib/workspace-restriction-guard", () => ({
    enforceWorkspaceRestriction,
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
        Response.json(
          { code: "INTERNAL_ERROR", message: fallbackMessage },
          { status: 500 },
        ),
      ),
    }));
  }

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

  it("preserves FEATURE_NOT_AVAILABLE from report download query", async () => {
    const { GET, mocks } = await setupRoute({
      queryImpl: vi.fn(async () => {
        throw {
          data: {
            code: "FEATURE_NOT_AVAILABLE",
            message: "Ekspor report hanya tersedia untuk paket Pro atau Enterprise.",
          },
        };
      }),
      useActualApiError: true,
    });

    const response = await GET(
      new Request("http://localhost/api/admin/reports/download?reportId=report_123", {
        headers: { "x-workspace-id": "workspace_123456" },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "FEATURE_NOT_AVAILABLE",
      message: "Ekspor report hanya tersedia untuk paket Pro atau Enterprise.",
    });
    expect(mocks.query).toHaveBeenCalledWith("reports:getDownloadUrl", {
      reportId: "report_123",
      workspaceId: "workspace_123456",
    });
  });

  it("blocks report downloads when workspace is restricted", async () => {
    const restricted = Response.json(
      {
        code: "WORKSPACE_RESTRICTED_EXPIRED",
        message:
          "Dashboard diblokir sampai workspace kembali patuh ke batas paket Free atau mengaktifkan paket berbayar lagi.",
      },
      { status: 409 },
    );
    const { GET, mocks } = await setupRoute({ restrictionResponse: restricted });

    const response = await GET(
      new Request("http://localhost/api/admin/reports/download?reportId=report_123", {
        headers: { "x-workspace-id": "workspace_123456" },
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "WORKSPACE_RESTRICTED_EXPIRED",
      message:
        "Dashboard diblokir sampai workspace kembali patuh ke batas paket Free atau mengaktifkan paket berbayar lagi.",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
