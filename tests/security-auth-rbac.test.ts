import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultAttendanceSchedule,
  ensureGlobalSettingsForMutation,
} from "../convex/helpers";

type RoleResult = { error: Response } | { session: { role: string } };

type CommonSetupOptions = {
  roleResult?: RoleResult;
  convexToken?: string | null;
  convexClient?: {
    query?: ReturnType<typeof vi.fn>;
    mutation?: ReturnType<typeof vi.fn>;
  } | null;
  workspaceContext?: { error: Response } | { workspace: { workspaceId: string } };
  useActualApiError?: boolean;
};

function buildWorkspaceContextMock(options: CommonSetupOptions) {
  return vi.fn(() => {
    if (options.workspaceContext) {
      return options.workspaceContext;
    }
    return {
      workspace: { workspaceId: "workspace_123456" },
    };
  });
}

async function setupDeviceQrTokenRoute(options: CommonSetupOptions = {}) {
  vi.resetModules();

  const requireWorkspaceDeviceApi = vi.fn(
    async () => {
      if (options.workspaceContext && "error" in options.workspaceContext) {
        return options.workspaceContext;
      }

      return options.roleResult ?? {
        workspace: { workspaceId: "workspace_123456" },
        device: {
          deviceId: "device_123",
          label: "Front Desk Tablet",
          claimedAt: 1_234_567_890,
        },
      };
    },
  );
  const mutation =
    options.convexClient?.mutation ??
    vi.fn(async () => ({ token: "issued-token", expiresAt: 12345 }));
  const getAuthedConvexHttpClient = vi.fn(() =>
    options.convexClient === null ? null : { mutation },
  );

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceDeviceApi,
  }));
  vi.doMock("@/lib/convex-http", () => ({
    getAuthedConvexHttpClient,
    getPublicConvexHttpClient: getAuthedConvexHttpClient,
  }));
  const actualApiError = await vi.importActual<typeof import("../lib/api-error")>(
    "../lib/api-error",
  );
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: actualApiError.convexErrorResponse,
  }));

  const routeModule = await import("../app/api/device/qr-token/route");
  return {
    GET: routeModule.GET,
    mocks: {
      requireWorkspaceDeviceApi,
      getAuthedConvexHttpClient,
      mutation,
    },
  };
}

async function setupAdminSettingsRoute(options: CommonSetupOptions = {}) {
  vi.resetModules();

  const requireWorkspaceRoleApiFromDb = vi.fn(
    async () => options.roleResult ?? { session: { role: "superadmin" } },
  );
  const getConvexTokenOrNull = vi.fn(async () =>
    options.convexToken === undefined ? "convex-token" : options.convexToken,
  );
  const mutation = options.convexClient?.mutation ?? vi.fn(async () => null);
  const query =
    options.convexClient?.query ??
    vi.fn(async () => ({
      timezone: "Asia/Jakarta",
      geofenceEnabled: false,
      geofenceRadiusMeters: 100,
      whitelistEnabled: false,
      whitelistIps: [],
    }));
  const getAuthedConvexHttpClient = vi.fn(() =>
    options.convexClient === null
      ? null
      : {
          query,
          mutation,
        },
  );

  vi.doMock("@/lib/auth", () => ({
    requireWorkspaceRoleApiFromDb,
    getConvexTokenOrNull,
    requireWorkspaceApiContext: buildWorkspaceContextMock(options),
  }));
  vi.doMock("@/lib/convex-http", () => ({
    getAuthedConvexHttpClient,
  }));
  const actualApiError = await vi.importActual<typeof import("../lib/api-error")>(
    "../lib/api-error",
  );
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: actualApiError.convexErrorResponse,
  }));

  const routeModule = await import("../app/api/admin/settings/route");
  return {
    GET: routeModule.GET,
    PATCH: routeModule.PATCH,
    mocks: {
      requireWorkspaceRoleApiFromDb,
      getConvexTokenOrNull,
      getAuthedConvexHttpClient,
      query,
      mutation,
    },
  };
}

describe("security auth and rbac routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns workspace required when workspace context is missing", async () => {
    const missingWorkspace = Response.json(
      { code: "WORKSPACE_REQUIRED", message: "Missing x-workspace-id header" },
      { status: 400 },
    );
    const { GET, mocks } = await setupDeviceQrTokenRoute({
      workspaceContext: { error: missingWorkspace },
    });

    const response = await GET(
      new Request("http://localhost/api/device/qr-token", { method: "GET" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "WORKSPACE_REQUIRED",
      message: "Missing x-workspace-id header",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("denies /api/device/qr-token when role check fails", async () => {
    const denied = Response.json(
      { code: "FORBIDDEN", message: "Forbidden" },
      { status: 403 },
    );
    const { GET, mocks } = await setupDeviceQrTokenRoute({
      roleResult: { error: denied },
    });

    const response = await GET(
      new Request("http://localhost/api/device/qr-token", { method: "GET" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "FORBIDDEN",
      message: "Forbidden",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("allows /api/device/qr-token for authenticated device", async () => {
    const { GET, mocks } = await setupDeviceQrTokenRoute();

    const response = await GET(
      new Request("http://localhost/api/device/qr-token", { method: "GET" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      token: "issued-token",
      expiresAt: 12345,
    });
    expect(mocks.mutation).toHaveBeenCalledWith("qrTokens:issue", {
      workspaceId: "workspace_123456",
      deviceId: "device_123",
    });
  });

  it("denies /api/admin/settings when role is not superadmin", async () => {
    const denied = Response.json(
      { code: "FORBIDDEN", message: "Forbidden" },
      { status: 403 },
    );
    const { GET, mocks } = await setupAdminSettingsRoute({
      roleResult: { error: denied },
    });

    const response = await GET(
      new Request("http://localhost/api/admin/settings", { method: "GET" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "FORBIDDEN",
      message: "Forbidden",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("returns 401 on /api/admin/settings when convex token is missing", async () => {
    const { GET, mocks } = await setupAdminSettingsRoute({ convexToken: null });

    const response = await GET(
      new Request("http://localhost/api/admin/settings", { method: "GET" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "UNAUTHENTICATED",
      message: "Unauthorized",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("loads settings for superadmin using ensureGlobal + get", async () => {
    const { GET, mocks } = await setupAdminSettingsRoute();

    const response = await GET(
      new Request("http://localhost/api/admin/settings", { method: "GET" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.mutation).toHaveBeenCalledWith("settings:ensureGlobal", {
      workspaceId: "workspace_123456",
    });
    expect(mocks.query).toHaveBeenCalledWith("settings:get", {
      workspaceId: "workspace_123456",
    });
  });

  it("provides the default weekly attendance schedule", () => {
    expect(defaultAttendanceSchedule()).toEqual([
      { day: "monday", enabled: true, checkInTime: "08:00" },
      { day: "tuesday", enabled: true, checkInTime: "08:00" },
      { day: "wednesday", enabled: true, checkInTime: "08:00" },
      { day: "thursday", enabled: true, checkInTime: "08:00" },
      { day: "friday", enabled: true, checkInTime: "08:00" },
      { day: "saturday", enabled: false },
      { day: "sunday", enabled: false },
    ]);
  });

  it("backfills attendanceSchedule during ensure flow for older settings", async () => {
    const existing = {
      _id: "settings_123",
      workspaceId: "workspace_123456",
      timezone: "Asia/Jakarta",
      geofenceEnabled: false,
      geofenceRadiusMeters: 100,
      whitelistEnabled: false,
      whitelistIps: [],
      updatedAt: 1,
    };
    const patch = vi.fn(async () => null);
    const get = vi.fn(async () => ({
      ...existing,
      scanCooldownSeconds: 30,
      minLocationAccuracyMeters: 100,
      enforceDeviceHeartbeat: false,
      attendanceSchedule: defaultAttendanceSchedule(),
    }));
    const unique = vi.fn(async () => existing);

    const result = await ensureGlobalSettingsForMutation(
      {
        db: {
          query: vi.fn(() => ({
            withIndex: vi.fn(() => ({
              unique,
            })),
          })),
          patch,
          get,
          insert: vi.fn(),
        },
      },
      "workspace_123456",
    );

    expect(patch).toHaveBeenCalledWith("settings_123", {
      scanCooldownSeconds: 30,
      minLocationAccuracyMeters: 100,
      enforceDeviceHeartbeat: false,
      attendanceSchedule: defaultAttendanceSchedule(),
    });
    expect(result.attendanceSchedule).toEqual(defaultAttendanceSchedule());
  });

  it("updates settings via PATCH for superadmin", async () => {
    const mutation = vi.fn(async () => null);
    const { PATCH } = await setupAdminSettingsRoute({
      convexClient: { mutation, query: vi.fn() },
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          timezone: "Asia/Jakarta",
          geofenceEnabled: true,
          geofenceRadiusMeters: 150,
          minLocationAccuracyMeters: 30,
          geofenceLat: -6.2,
          geofenceLng: 106.8,
          whitelistEnabled: true,
          whitelistIps: ["203.0.113.1"],
          attendanceSchedule: [
            { day: "monday", enabled: true, checkInTime: "08:00" },
            { day: "tuesday", enabled: true, checkInTime: "08:00" },
            { day: "wednesday", enabled: true, checkInTime: "08:00" },
            { day: "thursday", enabled: true, checkInTime: "08:00" },
            { day: "friday", enabled: true, checkInTime: "08:00" },
            { day: "saturday", enabled: false },
            { day: "sunday", enabled: false },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mutation).toHaveBeenCalledWith("settings:update", {
      workspaceId: "workspace_123456",
      timezone: "Asia/Jakarta",
      geofenceEnabled: true,
      geofenceRadiusMeters: 150,
      minLocationAccuracyMeters: 30,
      geofenceLat: -6.2,
      geofenceLng: 106.8,
      whitelistEnabled: true,
      whitelistIps: ["203.0.113.1"],
      attendanceSchedule: defaultAttendanceSchedule(),
    });
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns validation errors from settings mutation when geofence payload is invalid", async () => {
    const mutation = vi.fn(async () => {
      const error = new Error("invalid geofence payload") as Error & {
        data?: { code: string; message: string };
      };
      error.data = {
        code: "VALIDATION_ERROR",
        message: "Latitude dan longitude geofence wajib diisi saat geofence aktif.",
      };
      throw error;
    });
    const { PATCH } = await setupAdminSettingsRoute({
      convexClient: { mutation, query: vi.fn() },
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          geofenceEnabled: true,
          geofenceRadiusMeters: 150,
          minLocationAccuracyMeters: 30,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "VALIDATION_ERROR",
      message: "Latitude dan longitude geofence wajib diisi saat geofence aktif.",
    });
    expect(mutation).toHaveBeenCalledOnce();
  });

  it("preserves FEATURE_NOT_AVAILABLE from settings mutation over HTTP", async () => {
    const mutation = vi.fn(async () => {
      throw {
        data: {
          code: "FEATURE_NOT_AVAILABLE",
          message: "Geofence hanya tersedia untuk paket Pro atau Enterprise.",
        },
      };
    });
    const { PATCH } = await setupAdminSettingsRoute({
      convexClient: { mutation, query: vi.fn() },
      useActualApiError: true,
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          geofenceEnabled: true,
          geofenceRadiusMeters: 150,
          minLocationAccuracyMeters: 30,
          geofenceLat: -6.2,
          geofenceLng: 106.8,
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "FEATURE_NOT_AVAILABLE",
      message: "Geofence hanya tersedia untuk paket Pro atau Enterprise.",
    });
    expect(mutation).toHaveBeenCalledOnce();
  });

  it("rejects attendanceSchedule rows with invalid HH:mm", async () => {
    const mutation = vi.fn(async () => null);
    const { PATCH } = await setupAdminSettingsRoute({
      convexClient: { mutation, query: vi.fn() },
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attendanceSchedule: [
            { day: "monday", enabled: true, checkInTime: "25:00" },
            { day: "tuesday", enabled: true, checkInTime: "08:00" },
            { day: "wednesday", enabled: true, checkInTime: "08:00" },
            { day: "thursday", enabled: true, checkInTime: "08:00" },
            { day: "friday", enabled: true, checkInTime: "08:00" },
            { day: "saturday", enabled: false },
            { day: "sunday", enabled: false },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "BAD_REQUEST",
      message: "Attendance schedule tidak valid.",
    });
    expect(mutation).not.toHaveBeenCalled();
  });

  it("rejects enabled attendanceSchedule rows without checkInTime", async () => {
    const mutation = vi.fn(async () => null);
    const { PATCH } = await setupAdminSettingsRoute({
      convexClient: { mutation, query: vi.fn() },
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attendanceSchedule: [
            { day: "monday", enabled: true },
            { day: "tuesday", enabled: true, checkInTime: "08:00" },
            { day: "wednesday", enabled: true, checkInTime: "08:00" },
            { day: "thursday", enabled: true, checkInTime: "08:00" },
            { day: "friday", enabled: true, checkInTime: "08:00" },
            { day: "saturday", enabled: false },
            { day: "sunday", enabled: false },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "BAD_REQUEST",
      message: "Attendance schedule tidak valid.",
    });
    expect(mutation).not.toHaveBeenCalled();
  });
});
