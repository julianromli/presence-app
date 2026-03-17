import { beforeEach, describe, expect, it, vi } from "vitest";

type RoleResult = { error: Response } | { session: { role: string } };
type WorkspaceContextResult =
  | { error: Response }
  | { workspace: { workspaceId: string } };

type RouteSetupOptions = {
  roleResult?: RoleResult;
  convexToken?: string | null;
  queryImpl?: ReturnType<typeof vi.fn>;
  mutationImpl?: ReturnType<typeof vi.fn>;
  workspaceContext?: WorkspaceContextResult;
};

function makeWorkspaceContext(options: RouteSetupOptions) {
  if (options.workspaceContext) {
    return options.workspaceContext;
  }
  return { workspace: { workspaceId: "workspace_123456" } };
}

async function setupSummaryRoute(options: RouteSetupOptions = {}) {
  vi.resetModules();

  const requireWorkspaceRoleApiFromDb = vi.fn(
    async () => options.roleResult ?? { session: { role: "admin" } },
  );
  const getConvexTokenOrNull = vi.fn(async () =>
    options.convexToken === undefined ? "convex-token" : options.convexToken,
  );
  const query =
    options.queryImpl ??
    vi.fn(async () => ({
      total: 2,
      checkedIn: 2,
      checkedOut: 1,
      edited: 0,
    }));
  const getAuthedConvexHttpClient = vi.fn(() => ({ query }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceRoleApiFromDb,
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    getConvexTokenOrNull,
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/admin/attendance/summary/route");
  return { GET: routeModule.GET, mocks: { query } };
}

async function setupScanEventsRoute(options: RouteSetupOptions = {}) {
  vi.resetModules();

  const requireWorkspaceRoleApiFromDb = vi.fn(
    async () => options.roleResult ?? { session: { role: "admin" } },
  );
  const getConvexTokenOrNull = vi.fn(async () =>
    options.convexToken === undefined ? "convex-token" : options.convexToken,
  );
  const query =
    options.queryImpl ??
    vi.fn(async () => ({
      rows: [],
      summary: {
        total: 0,
        accepted: 0,
        rejected: 0,
        byReason: [],
      },
    }));
  const getAuthedConvexHttpClient = vi.fn(() => ({ query }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceRoleApiFromDb,
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    getConvexTokenOrNull,
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/admin/attendance/scan-events/route");
  return { GET: routeModule.GET, mocks: { query } };
}

async function setupEditRoute(options: RouteSetupOptions = {}) {
  vi.resetModules();

  const requireWorkspaceRoleApiFromDb = vi.fn(
    async () => options.roleResult ?? { session: { role: "admin" } },
  );
  const getConvexTokenOrNull = vi.fn(async () =>
    options.convexToken === undefined ? "convex-token" : options.convexToken,
  );
  const mutation = options.mutationImpl ?? vi.fn(async () => null);
  const getAuthedConvexHttpClient = vi.fn(() => ({ mutation }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceRoleApiFromDb,
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    getConvexTokenOrNull,
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const routeModule = await import("../app/api/admin/attendance/edit/route");
  return { PATCH: routeModule.PATCH, mocks: { mutation } };
}

describe("admin attendance secondary routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("summary route requires dateKey", async () => {
    const { GET, mocks } = await setupSummaryRoute();

    const response = await GET(new Request("http://localhost/api/admin/attendance/summary"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION_ERROR",
      message: "dateKey wajib diisi.",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("summary route passes workspace and dateKey to convex", async () => {
    const { GET, mocks } = await setupSummaryRoute();

    const response = await GET(
      new Request("http://localhost/api/admin/attendance/summary?dateKey=2026-03-05"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      total: 2,
      checkedIn: 2,
      checkedOut: 1,
      edited: 0,
    });
    expect(mocks.query).toHaveBeenCalledWith("attendance:getSummaryByDate", {
      dateKey: "2026-03-05",
      workspaceId: "workspace_123456",
    });
  });

  it("scan-events route clamps invalid status and limit values", async () => {
    const { GET, mocks } = await setupScanEventsRoute();

    const response = await GET(
      new Request(
        "http://localhost/api/admin/attendance/scan-events?dateKey=2026-03-05&status=weird&limit=999",
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith("attendance:listScanEventsByDate", {
      dateKey: "2026-03-05",
      workspaceId: "workspace_123456",
      status: undefined,
      limit: 200,
    });
  });

  it("scan-events route preserves accepted status and fallback limit for NaN", async () => {
    const { GET, mocks } = await setupScanEventsRoute();

    const response = await GET(
      new Request(
        "http://localhost/api/admin/attendance/scan-events?dateKey=2026-03-05&status=accepted&limit=oops",
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith("attendance:listScanEventsByDate", {
      dateKey: "2026-03-05",
      workspaceId: "workspace_123456",
      status: "accepted",
      limit: 60,
    });
  });

  it("edit route rejects invalid numeric payloads before mutation", async () => {
    const { PATCH, mocks } = await setupEditRoute();

    const response = await PATCH(
      new Request("http://localhost/api/admin/attendance/edit", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attendanceId: "attendance_123",
          reason: "manual correction",
          checkInAt: "bad-value",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION_ERROR",
      message: "checkInAt tidak valid.",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("edit route forwards validated payload to convex", async () => {
    const { PATCH, mocks } = await setupEditRoute();

    const response = await PATCH(
      new Request("http://localhost/api/admin/attendance/edit", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attendanceId: "attendance_123",
          reason: "manual correction",
          checkInAt: 1_700_000_000_000,
          checkOutAt: 1_700_000_360_000,
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.mutation).toHaveBeenCalledWith("attendance:editAttendance", {
      workspaceId: "workspace_123456",
      attendanceId: "attendance_123",
      checkInAt: 1_700_000_000_000,
      checkOutAt: 1_700_000_360_000,
      reason: "manual correction",
    });
  });
});
