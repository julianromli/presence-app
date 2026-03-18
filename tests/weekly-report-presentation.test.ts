import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatWeeklyReportFileMeta,
  formatWeeklyReportSourceLabel,
  formatWeeklyReportStatusLabel,
  getWeeklyReportTimestampMeta,
} from "@/lib/weekly-report-presentation";

describe("weekly report presentation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns readable labels for success reports", () => {
    vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("18/03/2026, 10.00.00");

    expect(formatWeeklyReportStatusLabel("success")).toBe("Berhasil");
    expect(formatWeeklyReportSourceLabel("manual")).toBe("Manual");
    expect(
      getWeeklyReportTimestampMeta({
        status: "success",
        generatedAt: 1_000,
        finishedAt: 2_000,
      }),
    ).toEqual({
      label: "Terbit",
      value: "18/03/2026, 10.00.00",
    });
    expect(
      formatWeeklyReportFileMeta({
        status: "success",
        weekKey: "2026-03-02_2026-03-08",
        fileName: "absenin.xlsx",
        byteLength: 1_536,
      }),
    ).toEqual({
      primary: "absenin.xlsx",
      secondary: "1.5 KB",
    });
  });

  it("uses finishedAt for failed reports and returns pending placeholders", () => {
    vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("18/03/2026, 11.00.00");

    expect(formatWeeklyReportStatusLabel("failed")).toBe("Gagal");
    expect(formatWeeklyReportSourceLabel("cron")).toBe("Cron");
    expect(
      getWeeklyReportTimestampMeta({
        status: "failed",
        finishedAt: 3_000,
      }),
    ).toEqual({
      label: "Gagal",
      value: "18/03/2026, 11.00.00",
    });
    expect(
      formatWeeklyReportFileMeta({
        status: "pending",
        weekKey: "2026-03-02_2026-03-08",
      }),
    ).toEqual({
      primary: "Belum tersedia",
      secondary: "File akan siap setelah proses selesai.",
    });
  });
});
