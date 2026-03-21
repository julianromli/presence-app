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

async function setupCurrentWorkspaceRoute(options: SetupOptions = {}) {
  vi.resetModules();

  const query = vi.fn(async () => ({
    workspaceId: "workspace_123456",
    subscription: {
      plan: "free",
      limits: {
        maxOwnedWorkspaces: 1,
        maxMembersPerWorkspace: 5,
        maxDevicesPerWorkspace: 1,
      },
      features: {
        geofence: false,
        ipWhitelist: false,
        attendanceSchedule: true,
        reportExport: false,
        inviteRotation: true,
        inviteExpiry: false,
      },
      usage: {
        activeMembers: 3,
        activeDevices: 1,
      },
    },
  }));
  const getAuthedConvexHttpClient = vi.fn(() => ({ query }));

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    requireWorkspaceRoleApiFromDb: vi.fn(
      async () => options.roleResult ?? { session: { role: "karyawan" } },
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

  const routeModule = await import("../app/api/workspaces/current/route");
  return {
    GET: routeModule.GET,
    mocks: { query },
  };
}

describe("workspace current route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the active workspace subscription summary", async () => {
    const { GET, mocks } = await setupCurrentWorkspaceRoute();

    const response = await GET(
      new Request("http://localhost/api/workspaces/current", {
        headers: { "x-workspace-id": "workspace_123456" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith("workspaces:currentWorkspaceSummary", {
      workspaceId: "workspace_123456",
    });
    await expect(response.json()).resolves.toEqual({
      workspaceId: "workspace_123456",
      subscription: {
        plan: "free",
        limits: {
          maxOwnedWorkspaces: 1,
          maxMembersPerWorkspace: 5,
          maxDevicesPerWorkspace: 1,
        },
        features: {
          geofence: false,
          ipWhitelist: false,
          attendanceSchedule: true,
          reportExport: false,
          inviteRotation: true,
          inviteExpiry: false,
        },
        usage: {
          activeMembers: 3,
          activeDevices: 1,
        },
      },
    });
  });

  it("returns forbidden when workspace role check fails", async () => {
    const forbidden = Response.json({ code: "FORBIDDEN", message: "Forbidden" }, { status: 403 });
    const { GET, mocks } = await setupCurrentWorkspaceRoute({
      roleResult: { error: forbidden },
    });

    const response = await GET(
      new Request("http://localhost/api/workspaces/current", {
        headers: { "x-workspace-id": "workspace_123456" },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ code: "FORBIDDEN", message: "Forbidden" });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
