import { beforeEach, describe, expect, it, vi } from "vitest";

type RoleResult = { error: Response } | { session: { role: string } };

type SetupOptions = {
  roleResult?: RoleResult;
  workspaceContext?: { error: Response } | { workspace: { workspaceId: string } };
};

function makeWorkspaceContext(options: SetupOptions) {
  if (options.workspaceContext) {
    return options.workspaceContext;
  }
  return { workspace: { workspaceId: "workspace_123456" } };
}

async function setupOverviewRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const query = vi.fn(async () => ({
    cards: {
      disciplineScore: 80,
      onTimeThisWeek: 4,
      lateThisWeek: 1,
      avgCheckInTime: "07:52",
      improvementMinutes: 6,
      weeklyPoints: 42,
      streakDays: 2,
    },
    trend14d: [],
    insight: "ok",
    badgeProgress: {
      current: "bronze",
      next: "silver",
      currentPoints: 42,
      targetPoints: 60,
      remainingPoints: 18,
    },
  }));
  const mutation = vi.fn(async () => null);
  const getAuthedConvexHttpClient = vi.fn(() => ({ query, mutation }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    requireWorkspaceRoleApiFromDb: vi.fn(
      async () => options.roleResult ?? { session: { role: "karyawan" } },
    ),
    getConvexTokenOrNull: vi.fn(async () => "convex-token"),
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/karyawan/dashboard/overview/route");
  return { GET: routeModule.GET, mocks: { query, mutation } };
}

async function setupAttendanceRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const query = vi.fn(async () => ({
    rows: [],
    pageInfo: { continueCursor: "", isDone: true },
    summary: { totalRows: 0, onTime: 0, late: 0, incomplete: 0, absent: 0 },
  }));
  const mutation = vi.fn(async () => null);
  const getAuthedConvexHttpClient = vi.fn(() => ({ query, mutation }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    requireWorkspaceRoleApiFromDb: vi.fn(
      async () => options.roleResult ?? { session: { role: "karyawan" } },
    ),
    getConvexTokenOrNull: vi.fn(async () => "convex-token"),
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/karyawan/dashboard/attendance/route");
  return { GET: routeModule.GET, mocks: { query, mutation } };
}

async function setupAttendanceByDateRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const query = vi.fn(async () => ({
    timeZone: "Asia/Jakarta",
    row: null,
  }));
  const mutation = vi.fn(async () => null);
  const getAuthedConvexHttpClient = vi.fn(() => ({ query, mutation }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    requireWorkspaceRoleApiFromDb: vi.fn(
      async () => options.roleResult ?? { session: { role: "karyawan" } },
    ),
    getConvexTokenOrNull: vi.fn(async () => "convex-token"),
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/karyawan/dashboard/attendance/by-date/route");
  return { GET: routeModule.GET, mocks: { query, mutation } };
}

async function setupLeaderboardRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const query = vi.fn(async () => ({
    weekLabel: "2026-03-02 s/d 2026-03-08",
    myRank: 1,
    myPoints: 99,
    rows: [],
  }));
  const mutation = vi.fn(async () => null);
  const getAuthedConvexHttpClient = vi.fn(() => ({ query, mutation }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    requireWorkspaceRoleApiFromDb: vi.fn(
      async () => options.roleResult ?? { session: { role: "karyawan" } },
    ),
    getConvexTokenOrNull: vi.fn(async () => "convex-token"),
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/karyawan/dashboard/leaderboard/route");
  return { GET: routeModule.GET, mocks: { query, mutation } };
}

describe("karyawan route workspace policy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 when workspace header is missing", async () => {
    const missingWorkspace = Response.json(
      { code: "WORKSPACE_REQUIRED", message: "Missing x-workspace-id header" },
      { status: 400 },
    );
    const { GET } = await setupOverviewRoute({
      workspaceContext: { error: missingWorkspace },
    });

    const response = await GET(new Request("http://localhost/api/karyawan/dashboard/overview"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "WORKSPACE_REQUIRED",
      message: "Missing x-workspace-id header",
    });
  });

  it("passes strict workspaceId to overview query and does not call settings mutation", async () => {
    const { GET, mocks } = await setupOverviewRoute();

    const response = await GET(new Request("http://localhost/api/karyawan/dashboard/overview"));
    expect(response.status).toBe(200);
    expect(mocks.mutation).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledWith("dashboardEmployee:getOverview", {
      workspaceId: "workspace_123456",
    });
  });

  it("returns forbidden when role check fails", async () => {
    const forbidden = Response.json(
      { code: "FORBIDDEN", message: "Forbidden" },
      { status: 403 },
    );
    const { GET, mocks } = await setupOverviewRoute({
      roleResult: { error: forbidden },
    });

    const response = await GET(new Request("http://localhost/api/karyawan/dashboard/overview"));
    expect(response.status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("passes strict workspaceId to attendance query", async () => {
    const { GET, mocks } = await setupAttendanceRoute();
    const response = await GET(
      new Request("http://localhost/api/karyawan/dashboard/attendance?range=7d&limit=10"),
    );
    expect(response.status).toBe(200);
    expect(mocks.mutation).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledWith("dashboardEmployee:listAttendanceHistory", {
      workspaceId: "workspace_123456",
      range: "7d",
      paginationOpts: {
        numItems: 10,
        cursor: null,
      },
    });
  });

  it("passes strict workspaceId and dateKey to attendance-by-date query", async () => {
    const { GET, mocks } = await setupAttendanceByDateRoute();
    const response = await GET(
      new Request(
        "http://localhost/api/karyawan/dashboard/attendance/by-date?dateKey=2026-03-08",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.mutation).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledWith("dashboardEmployee:getAttendanceByDate", {
      workspaceId: "workspace_123456",
      dateKey: "2026-03-08",
    });
  });

  it("passes strict workspaceId to leaderboard query", async () => {
    const { GET, mocks } = await setupLeaderboardRoute();
    const response = await GET(new Request("http://localhost/api/karyawan/dashboard/leaderboard"));
    expect(response.status).toBe(200);
    expect(mocks.mutation).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledWith("dashboardEmployee:getLeaderboard", {
      workspaceId: "workspace_123456",
    });
  });
});
