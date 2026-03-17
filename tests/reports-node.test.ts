import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../convex/_generated/server", () => ({
  internalAction: (config: unknown) => config,
}));

vi.mock("../convex/_generated/api", () => ({
  internal: {
    settings: {
      ensureGlobalInternal: "internal:settings.ensureGlobalInternal",
      getGlobalUnsafe: "internal:settings.getGlobalUnsafe",
    },
    reports: {
      beginWeeklyReport: "internal:reports.beginWeeklyReport",
      markWeeklyReport: "internal:reports.markWeeklyReport",
    },
    attendance: {
      listByDateRangeUnsafe: "internal:attendance.listByDateRangeUnsafe",
    },
    reportsNode: {
      runWeeklyReport: "internal:reportsNode.runWeeklyReport",
    },
    workspaces: {
      listActiveWorkspaceIds: "internal:workspaces.listActiveWorkspaceIds",
    },
  },
}));

const bookNew = vi.fn(() => ({ sheets: [] }));
const jsonToSheet = vi.fn((rows) => ({ rows }));
const bookAppendSheet = vi.fn();
const writeWorkbook = vi.fn(() => new Uint8Array([1, 2, 3]).buffer);

vi.mock("xlsx", () => ({
  default: {
    utils: {
      book_new: bookNew,
      json_to_sheet: jsonToSheet,
      book_append_sheet: bookAppendSheet,
    },
    write: writeWorkbook,
  },
  utils: {
    book_new: bookNew,
    json_to_sheet: jsonToSheet,
    book_append_sheet: bookAppendSheet,
  },
  write: writeWorkbook,
}));

describe("convex reports node actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-03-05T01:00:00.000Z").getTime());
    bookNew.mockClear();
    jsonToSheet.mockClear();
    bookAppendSheet.mockClear();
    writeWorkbook.mockClear();
  });

  it("skips generation when beginWeeklyReport says the report is already final", async () => {
    const { runWeeklyReport } = await import("../convex/reportsNode");
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        reportId: "report_123",
        runGeneration: false,
        status: "success",
        startedAt: 100,
        attempts: 2,
      });
    const runQuery = vi.fn(async (reference: string) => {
      if (reference === "internal:settings.getGlobalUnsafe") {
        return { timezone: "Asia/Jakarta" };
      }
      throw new Error(`Unexpected runQuery call: ${reference}`);
    });

    const result = await runWeeklyReport.handler(
      {
        runMutation,
        runQuery,
        storage: {
          store: vi.fn(),
          getUrl: vi.fn(),
        },
      } as never,
      {
        triggerSource: "manual",
        triggeredBy: "user_admin" as never,
        workspaceId: "workspace_123456" as never,
      },
    );

    expect(result).toEqual({
      weekKey: "2026-03-02_2026-03-08",
      status: "success",
      skipped: true,
    });
    expect(bookNew).not.toHaveBeenCalled();
  });

  it("stores a workbook and marks the report successful when generation succeeds", async () => {
    const { runWeeklyReport } = await import("../convex/reportsNode");
    const markWeeklyReport = vi.fn(async () => null);
    const runMutation = vi.fn(async (reference: string) => {
      if (reference === "internal:settings.ensureGlobalInternal") {
        return null;
      }
      if (reference === "internal:reports.beginWeeklyReport") {
        return {
          reportId: "report_123",
          runGeneration: true,
          status: "pending",
          startedAt: 1_000,
          attempts: 1,
        };
      }
      if (reference === "internal:reports.markWeeklyReport") {
        return await markWeeklyReport(reference);
      }
      throw new Error(`Unexpected runMutation call: ${reference}`);
    });
    const runQuery = vi.fn(async (reference: string) => {
      if (reference === "internal:settings.getGlobalUnsafe") {
        return { timezone: "Invalid/Timezone" };
      }
      if (reference === "internal:attendance.listByDateRangeUnsafe") {
        return [
          {
            employeeName: "Ali",
            checkInAt: 1_700_000_000_000,
            checkOutAt: 1_700_000_360_000,
            dateKey: "2026-03-05",
            edited: false,
          },
        ];
      }
      throw new Error(`Unexpected runQuery call: ${reference}`);
    });
    const store = vi.fn(async () => "storage_123");
    const getUrl = vi.fn(async () => "https://files.example.com/report.xlsx");

    const result = await runWeeklyReport.handler(
      {
        runMutation,
        runQuery,
        storage: {
          store,
          getUrl,
        },
      } as never,
      {
        triggerSource: "manual",
        triggeredBy: "user_admin" as never,
        workspaceId: "workspace_123456" as never,
      },
    );

    expect(result).toEqual({
      weekKey: "2026-03-02_2026-03-08",
      status: "success",
      skipped: false,
    });
    expect(jsonToSheet).toHaveBeenCalledWith([
      expect.objectContaining({
        "Minggu Ke-": "2026-03-02_2026-03-08",
        "Nama Karyawan": "Ali",
      }),
    ]);
    expect(store).toHaveBeenCalledTimes(1);
    expect(getUrl).toHaveBeenCalledWith("storage_123");
    expect(runMutation).toHaveBeenCalledWith(
      "internal:reports.markWeeklyReport",
      expect.objectContaining({
        status: "success",
        workspaceId: "workspace_123456",
        storageId: "storage_123",
        fileUrl: "https://files.example.com/report.xlsx",
        attempts: 1,
      }),
    );
  });

  it("marks the report failed when generation throws", async () => {
    const { runWeeklyReport } = await import("../convex/reportsNode");
    const runMutation = vi.fn(async (reference: string) => {
      if (reference === "internal:settings.ensureGlobalInternal") {
        return null;
      }
      if (reference === "internal:reports.beginWeeklyReport") {
        return {
          reportId: "report_123",
          runGeneration: true,
          status: "pending",
          startedAt: 1_000,
          attempts: 3,
        };
      }
      if (reference === "internal:reports.markWeeklyReport") {
        return null;
      }
      throw new Error(`Unexpected runMutation call: ${reference}`);
    });
    const runQuery = vi.fn(async (reference: string) => {
      if (reference === "internal:settings.getGlobalUnsafe") {
        return { timezone: "Asia/Jakarta" };
      }
      if (reference === "internal:attendance.listByDateRangeUnsafe") {
        throw new Error("storage exploded");
      }
      throw new Error(`Unexpected runQuery call: ${reference}`);
    });

    const result = await runWeeklyReport.handler(
      {
        runMutation,
        runQuery,
        storage: {
          store: vi.fn(),
          getUrl: vi.fn(),
        },
      } as never,
      {
        triggerSource: "cron",
        triggeredBy: undefined,
        workspaceId: "workspace_123456" as never,
      },
    );

    expect(result).toEqual({
      weekKey: "2026-03-02_2026-03-08",
      status: "failed",
      skipped: false,
    });
    expect(runMutation).toHaveBeenCalledWith(
      "internal:reports.markWeeklyReport",
      expect.objectContaining({
        status: "failed",
        workspaceId: "workspace_123456",
        attempts: 3,
        errorMessage: expect.stringContaining("storage exploded"),
      }),
    );
  });
});
