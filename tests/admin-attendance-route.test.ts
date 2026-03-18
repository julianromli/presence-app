import { beforeEach, describe, expect, it, vi } from "vitest";

type RoleResult = { error: Response } | { session: { role: string } };

type SetupOptions = {
  roleResult?: RoleResult;
  convexToken?: string | null;
};

async function setupRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const requireWorkspaceRoleApiFromDb = vi.fn(
    async () => options.roleResult ?? { session: { role: "admin" } },
  );
  const getConvexTokenOrNull = vi.fn(async () =>
    options.convexToken === undefined ? "convex-token" : options.convexToken,
  );
  const query = vi.fn(async () => ({
    rowsPage: {
      page: [
        {
          _id: "row_1",
          employeeName: "Ali",
          dateKey: "2026-03-05",
          edited: false,
        },
      ],
      continueCursor: "",
      isDone: true,
    },
    summary: {
      total: 1,
      checkedIn: 1,
      checkedOut: 0,
      edited: 0,
    },
    timezone: "Asia/Jakarta",
  }));
  const getAuthedConvexHttpClient = vi.fn(() => ({ query }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceRoleApiFromDb,
    requireWorkspaceApiContext: vi.fn((request: Request) => ({
      workspace: {
        workspaceId:
          request.headers.get("x-workspace-id") ?? "workspace_123456",
      },
    })),
    getConvexTokenOrNull,
  }));
  vi.doMock("@/lib/convex-http", () => ({
    getAuthedConvexHttpClient,
  }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json(
        { code: "INTERNAL_ERROR", message: fallbackMessage },
        { status: 500 },
      ),
    ),
  }));

  const routeModule = await import("../app/api/admin/attendance/route");
  return {
    GET: routeModule.GET,
    mocks: {
      query,
      requireWorkspaceRoleApiFromDb,
      getConvexTokenOrNull,
      getAuthedConvexHttpClient,
    },
  };
}

describe("admin attendance route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns validation error when dateKey is missing", async () => {
    const { GET, mocks } = await setupRoute();

    const response = await GET(
      new Request("http://localhost/api/admin/attendance"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION_ERROR",
      message: "dateKey wajib diisi.",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("returns filtered summary from the paginated query payload", async () => {
    const { GET, mocks } = await setupRoute();

    const response = await GET(
      new Request(
        "http://localhost/api/admin/attendance?dateKey=2026-03-05&q=ali&edited=true&status=incomplete&limit=25",
        {
          headers: { "x-workspace-id": "workspace_123456" },
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      rows: [
        {
          _id: "row_1",
          employeeName: "Ali",
          dateKey: "2026-03-05",
          edited: false,
        },
      ],
      pageInfo: {
        continueCursor: "",
        isDone: true,
        splitCursor: null,
        pageStatus: null,
      },
      timezone: "Asia/Jakarta",
      summary: {
        total: 1,
        checkedIn: 1,
        checkedOut: 0,
        edited: 0,
      },
    });

    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledWith("attendance:listByDatePaginated", {
      dateKey: "2026-03-05",
      workspaceId: "workspace_123456",
      edited: true,
      employeeName: "ali",
      status: "incomplete",
      paginationOpts: {
        numItems: 25,
        cursor: null,
      },
    });
  });
});
