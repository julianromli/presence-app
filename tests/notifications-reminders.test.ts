import { beforeEach, describe, expect, it, vi } from "vitest";

const buildDateKey = vi.fn();
const getGlobalSettingsOrNull = vi.fn();
const requireWorkspaceRole = vi.fn();
const getMinutesInTimezone = vi.fn();

vi.mock("../convex/_generated/server", () => ({
  internalMutation: (config: unknown) => config,
  mutation: (config: unknown) => config,
  query: (config: unknown) => config,
}));

vi.mock("../convex/helpers", () => ({
  buildDateKey,
  getGlobalSettingsOrNull,
  requireWorkspaceRole,
}));

vi.mock("../convex/employeeDashboardKpi", () => ({
  getMinutesInTimezone,
  paginateRows: vi.fn(),
}));

describe("notification reminder flows", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    buildDateKey.mockReturnValue("2026-03-05");
    getGlobalSettingsOrNull.mockResolvedValue({ timezone: "Asia/Jakarta" });
    getMinutesInTimezone.mockReturnValue(16 * 60 + 45);
    requireWorkspaceRole.mockResolvedValue({
      user: { _id: "user_123" },
      membership: { role: "karyawan" },
    });
  });

  it("creates a new notification when no scoped source key exists", async () => {
    const { createOrMergeNotification } = await import("../convex/notifications");
    const insert = vi.fn(async () => "notification_123");
    const patch = vi.fn();
    const unique = vi.fn(async () => null);
    const ctx = {
      db: {
        insert,
        patch,
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({
            unique,
          })),
        })),
      },
    };

    const result = await createOrMergeNotification(ctx as never, {
      workspaceId: "workspace_123456",
      userId: "user_123",
      type: "attendance_reminder",
      title: "Jangan lupa scan pulang",
      description: "Reminder",
      severity: "warning",
      sourceKey: "attendance_reminder:checkout:2026-03-05:user_123",
      createdAt: 100,
    });

    expect(result).toEqual({
      notificationId: "notification_123",
      created: true,
    });
    expect(insert).toHaveBeenCalledWith(
      "employee_notifications",
      expect.objectContaining({
        workspaceScopedSourceKey:
          "workspace_123456:attendance_reminder:checkout:2026-03-05:user_123",
        readAt: undefined,
      }),
    );
    expect(patch).not.toHaveBeenCalled();
  });

  it("patches the existing notification instead of inserting a duplicate", async () => {
    const { createOrMergeNotification } = await import("../convex/notifications");
    const insert = vi.fn();
    const patch = vi.fn(async () => undefined);
    const unique = vi.fn(async () => ({
      _id: "notification_existing",
    }));
    const ctx = {
      db: {
        insert,
        patch,
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({
            unique,
          })),
        })),
      },
    };

    const result = await createOrMergeNotification(ctx as never, {
      workspaceId: "workspace_123456",
      userId: "user_123",
      type: "attendance_reminder",
      title: "Jangan lupa scan pulang",
      description: "Reminder",
      severity: "warning",
      sourceKey: "attendance_reminder:checkout:2026-03-05:user_123",
      createdAt: 100,
    });

    expect(result).toEqual({
      notificationId: "notification_existing",
      created: false,
    });
    expect(patch).toHaveBeenCalledWith(
      "notification_existing",
      expect.objectContaining({
        title: "Jangan lupa scan pulang",
        readAt: undefined,
      }),
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("expires an active checkout reminder once", async () => {
    const { expireCheckoutReminderForDate } = await import("../convex/notifications");
    const patch = vi.fn(async () => undefined);
    const unique = vi.fn(async () => ({
      _id: "notification_123",
      expiresAt: undefined,
    }));
    const ctx = {
      db: {
        patch,
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({
            unique,
          })),
        })),
      },
    };

    const result = await expireCheckoutReminderForDate(
      ctx as never,
      "workspace_123456",
      "user_123",
      "2026-03-05",
      200,
    );

    expect(result).toBe("notification_123");
    expect(patch).toHaveBeenCalledWith("notification_123", { expiresAt: 200 });
  });

  it("creates checkout reminders only for active workspaces after 16:30 with pending checkout", async () => {
    const { runCheckoutReminders } = await import("../convex/notifications");
    const insert = vi.fn(async () => "notification_123");
    const query = vi.fn((table: string) => {
      if (table === "workspaces") {
        return {
          collect: vi.fn(async () => [
            { _id: "workspace_123456", isActive: true },
            { _id: "workspace_inactive", isActive: false },
          ]),
        };
      }

      if (table === "attendance") {
        return {
          withIndex: vi.fn(() => ({
            collect: vi.fn(async () => [
              {
                userId: "user_123",
                checkInAt: 1_700_000_000_000,
                checkOutAt: undefined,
              },
            ]),
          })),
        };
      }

      if (table === "workspace_members") {
        return {
          withIndex: vi.fn(() => ({
            collect: vi.fn(async () => [
              { userId: "user_123", isActive: true },
            ]),
          })),
        };
      }

      if (table === "employee_notifications") {
        return {
          withIndex: vi.fn(() => ({
            unique: vi.fn(async () => null),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await runCheckoutReminders.handler(
      {
        db: {
          insert,
          patch: vi.fn(),
          query,
        },
      } as never,
      {},
    );

    expect(result).toEqual({
      workspacesScanned: 1,
      remindersCreated: 1,
    });
    expect(insert).toHaveBeenCalledWith(
      "employee_notifications",
      expect.objectContaining({
        workspaceId: "workspace_123456",
        userId: "user_123",
        type: "attendance_reminder",
        actionType: "open_scan",
        actionPayload: { dateKey: "2026-03-05" },
      }),
    );
  });

  it("skips reminder generation before the local cutoff time", async () => {
    const { runCheckoutReminders } = await import("../convex/notifications");
    getMinutesInTimezone.mockReturnValue(16 * 60 + 10);
    const insert = vi.fn();

    const result = await runCheckoutReminders.handler(
      {
        db: {
          insert,
          patch: vi.fn(),
          query: vi.fn((table: string) => {
            if (table === "workspaces") {
              return {
                collect: vi.fn(async () => [{ _id: "workspace_123456", isActive: true }]),
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          }),
        },
      } as never,
      {},
    );

    expect(result).toEqual({
      workspacesScanned: 1,
      remindersCreated: 0,
    });
    expect(insert).not.toHaveBeenCalled();
  });
});
