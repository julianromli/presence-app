import { beforeEach, describe, expect, it, vi } from "vitest";

const requireWorkspaceRole = vi.fn();

vi.mock("../convex/_generated/server", () => ({
  action: (config: unknown) => config,
  internalMutation: (config: unknown) => config,
  query: (config: unknown) => config,
}));

vi.mock("../convex/_generated/api", () => ({
  api: {
    users: { me: "users:me" },
    workspaces: { myMembershipByWorkspace: "workspaces:myMembershipByWorkspace" },
  },
  internal: {
    reportsNode: { runWeeklyReport: "internal:reportsNode.runWeeklyReport" },
  },
}));

vi.mock("../convex/helpers", () => ({
  requireWorkspaceRole,
}));

describe("convex reports queries and mutations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    requireWorkspaceRole.mockResolvedValue({
      user: { _id: "user_admin" },
      membership: { role: "admin" },
    });
  });

  it("regenerates storage urls for workspace-owned reports", async () => {
    const { getDownloadUrl } = await import("../convex/reports");
    const ctx = {
      db: {
        get: vi.fn(async () => ({
          _id: "report_123",
          workspaceId: "workspace_123456",
          weekKey: "2026-03-02_2026-03-08",
          fileUrl: "https://old.example.com/report.xlsx",
          storageId: "storage_123",
        })),
      },
      storage: {
        getUrl: vi.fn(async () => "https://files.example.com/report.xlsx"),
      },
    };

    const result = await getDownloadUrl.handler(ctx as never, {
      reportId: "report_123" as never,
      workspaceId: "workspace_123456" as never,
    });

    expect(result).toEqual({
      url: "https://files.example.com/report.xlsx",
      fileName: "absenin_id_2026-03-02_2026-03-08.xlsx",
    });
  });

  it("rejects download access when the report belongs to another workspace", async () => {
    const { getDownloadUrl } = await import("../convex/reports");
    const ctx = {
      db: {
        get: vi.fn(async () => ({
          _id: "report_123",
          workspaceId: "workspace_other",
          weekKey: "2026-03-02_2026-03-08",
        })),
      },
      storage: {
        getUrl: vi.fn(),
      },
    };

    await expect(
      getDownloadUrl.handler(ctx as never, {
        reportId: "report_123" as never,
        workspaceId: "workspace_123456" as never,
      }),
    ).rejects.toMatchObject({
      data: {
        code: "FORBIDDEN",
        message: "Report bukan milik workspace aktif.",
      },
    });
  });

  it("inserts a new weekly report row when markWeeklyReport has no existing record", async () => {
    const { markWeeklyReport } = await import("../convex/reports");
    const insert = vi.fn(async () => "report_123");
    const unique = vi.fn(async () => null);
    const ctx = {
      db: {
        insert,
        patch: vi.fn(),
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({
            unique,
          })),
        })),
      },
    };

    await expect(
      markWeeklyReport.handler(ctx as never, {
        weekKey: "2026-03-02_2026-03-08",
        startDate: "2026-03-02",
        endDate: "2026-03-08",
        status: "success",
        fileUrl: "https://files.example.com/report.xlsx",
        storageId: undefined,
        fileName: "absenin_id_2026-03-02_2026-03-08.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        byteLength: 512,
        errorMessage: undefined,
        startedAt: 100,
        finishedAt: 200,
        durationMs: 100,
        triggerSource: "manual",
        triggeredBy: "user_admin" as never,
        workspaceId: "workspace_123456" as never,
        lastTriggeredAt: 200,
        attempts: 1,
      }),
    ).resolves.toBeNull();

    expect(insert).toHaveBeenCalledWith(
      "weekly_reports",
      expect.objectContaining({
        workspaceId: "workspace_123456",
        weekKey: "2026-03-02_2026-03-08",
        status: "success",
        generatedAt: 200,
      }),
    );
  });

  it("preserves generatedAt when a pending report is updated", async () => {
    const { markWeeklyReport } = await import("../convex/reports");
    const patch = vi.fn(async () => undefined);
    const unique = vi.fn(async () => ({
      _id: "report_123",
      generatedAt: 999,
    }));
    const ctx = {
      db: {
        insert: vi.fn(),
        patch,
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({
            unique,
          })),
        })),
      },
    };

    await markWeeklyReport.handler(ctx as never, {
      weekKey: "2026-03-02_2026-03-08",
      startDate: "2026-03-02",
      endDate: "2026-03-08",
      status: "pending",
      fileUrl: undefined,
      storageId: undefined,
      fileName: undefined,
      mimeType: undefined,
      byteLength: undefined,
      errorMessage: undefined,
      startedAt: 100,
      finishedAt: undefined,
      durationMs: undefined,
      triggerSource: "cron",
      triggeredBy: undefined,
      workspaceId: "workspace_123456" as never,
      lastTriggeredAt: 100,
      attempts: 2,
    });

    expect(patch).toHaveBeenCalledWith(
      "report_123",
      expect.objectContaining({
        status: "pending",
        generatedAt: 999,
        attempts: 2,
      }),
    );
  });
});
