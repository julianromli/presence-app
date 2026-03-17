import { beforeEach, describe, expect, it, vi } from "vitest";

const requireWorkspaceRole = vi.fn();
const ensureGlobalSettingsForMutation = vi.fn();
const assertValidGeofenceSettings = vi.fn();
const normalizeAttendanceSchedule = vi.fn((value) => value);
const getGlobalSettingsOrThrow = vi.fn();

const BASE_ATTENDANCE_SCHEDULE = [
  { day: "monday", enabled: true, checkInTime: "08:00" },
  { day: "tuesday", enabled: true, checkInTime: "08:00" },
  { day: "wednesday", enabled: true, checkInTime: "08:00" },
  { day: "thursday", enabled: true, checkInTime: "08:00" },
  { day: "friday", enabled: true, checkInTime: "08:00" },
  { day: "saturday", enabled: false },
  { day: "sunday", enabled: false },
] as const;

const defaultAttendanceSchedule = vi.fn(() =>
  BASE_ATTENDANCE_SCHEDULE.map((row) => ({ ...row })),
);

vi.mock("../convex/_generated/server", () => ({
  internalMutation: (config: unknown) => config,
  internalQuery: (config: unknown) => config,
  mutation: (config: unknown) => config,
  query: (config: unknown) => config,
}));

vi.mock("../convex/helpers", () => ({
  assertValidGeofenceSettings,
  defaultAttendanceSchedule,
  ensureGlobalSettingsForMutation,
  getGlobalSettingsOrThrow,
  normalizeAttendanceSchedule,
  requireWorkspaceRole,
}));

function buildCurrentSettings() {
  return {
    _id: "settings_123",
    _creationTime: 1,
    key: "global" as const,
    workspaceId: "workspace_123456",
    timezone: "Asia/Jakarta",
    geofenceEnabled: false,
    geofenceRadiusMeters: 100,
    scanCooldownSeconds: 30,
    minLocationAccuracyMeters: 100,
    enforceDeviceHeartbeat: false,
    geofenceLat: undefined,
    geofenceLng: undefined,
    whitelistEnabled: false,
    whitelistIps: [],
    attendanceSchedule: defaultAttendanceSchedule(),
    updatedBy: "user_superadmin",
    updatedAt: 1,
  };
}

function buildCtx(plan: "free" | "pro" = "free") {
  const patch = vi.fn(async () => null);
  const insert = vi.fn(async () => null);
  const get = vi.fn(async (id: string) => {
    if (id === "workspace_123456") {
      return {
        _id: "workspace_123456",
        slug: "workspace",
        name: "Workspace",
        plan,
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      };
    }

    return null;
  });

  return {
    db: {
      get,
      insert,
      patch,
    },
  };
}

describe("settings premium plan gates", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    requireWorkspaceRole.mockResolvedValue({
      user: { _id: "user_superadmin" },
      membership: { role: "superadmin" },
    });
    ensureGlobalSettingsForMutation.mockResolvedValue(buildCurrentSettings());
    assertValidGeofenceSettings.mockReturnValue(undefined);
    normalizeAttendanceSchedule.mockImplementation((value) => value);
    getGlobalSettingsOrThrow.mockResolvedValue(buildCurrentSettings());
  });

  it("blocks enabling geofence for free workspaces", async () => {
    const { update } = await import("../convex/settings");
    const ctx = buildCtx("free");

    await expect(
      update.handler(ctx as never, {
        workspaceId: "workspace_123456" as never,
        geofenceEnabled: true,
      }),
    ).rejects.toMatchObject({
      data: {
        code: "FEATURE_NOT_AVAILABLE",
        message: "Geofence hanya tersedia untuk paket Pro atau Enterprise.",
      },
    });

    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it("blocks enabling IP whitelist for free workspaces", async () => {
    const { update } = await import("../convex/settings");
    const ctx = buildCtx("free");

    await expect(
      update.handler(ctx as never, {
        workspaceId: "workspace_123456" as never,
        whitelistEnabled: true,
      }),
    ).rejects.toMatchObject({
      data: {
        code: "FEATURE_NOT_AVAILABLE",
        message: "IP whitelist hanya tersedia untuk paket Pro atau Enterprise.",
      },
    });

    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it("blocks attendance schedule updates for free workspaces", async () => {
    const { update } = await import("../convex/settings");
    const ctx = buildCtx("free");

    await expect(
      update.handler(ctx as never, {
        workspaceId: "workspace_123456" as never,
        attendanceSchedule: defaultAttendanceSchedule(),
      }),
    ).rejects.toMatchObject({
      data: {
        code: "FEATURE_NOT_AVAILABLE",
        message:
          "Attendance schedule hanya tersedia untuk paket Pro atau Enterprise.",
      },
    });

    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });
});
