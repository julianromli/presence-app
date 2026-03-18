import { describe, expect, it, vi } from "vitest";

import {
  buildActiveAuditFilterBadges,
  buildAttendanceSectionCountLabel,
  buildAttendanceSearchParams,
  buildScanEventsSectionCountLabel,
  buildScanEventsSearchParams,
  refreshAttendanceAuditSections,
} from "../lib/report-panel-behavior";

describe("report panel behavior helpers", () => {
  it("refreshes attendance and scan events together for date-driven reloads", async () => {
    const loadAttendance = vi.fn(async () => undefined);
    const loadScanEvents = vi.fn(async () => undefined);

    await refreshAttendanceAuditSections({
      loadAttendance,
      loadScanEvents,
    });

    expect(loadAttendance).toHaveBeenCalledTimes(1);
    expect(loadScanEvents).toHaveBeenCalledTimes(1);
  });

  it("formats section count labels without mixing loaded and total counts", () => {
    expect(buildAttendanceSectionCountLabel({ loadedCount: 25, totalCount: 80 })).toBe(
      "25/80 baris dimuat",
    );
    expect(buildAttendanceSectionCountLabel({ loadedCount: 12, totalCount: 12 })).toBe(
      "12 baris",
    );
    expect(buildScanEventsSectionCountLabel({ loadedCount: 50, totalCount: 620 })).toBe(
      "50/620 event ditampilkan",
    );
  });

  it("builds attendance and scan-event query params from the active audit filters", () => {
    expect(
      buildAttendanceSearchParams({
        dateKey: "2026-03-18",
        employeeName: "Ali",
        editedFilter: "true",
        attendanceStatusFilter: "incomplete",
        cursor: "offset:25",
      }),
    ).toBe("dateKey=2026-03-18&limit=25&cursor=offset%3A25&q=Ali&edited=true&status=incomplete");

    expect(
      buildScanEventsSearchParams({
        dateKey: "2026-03-18",
        scanResultFilter: "rejected",
      }),
    ).toBe("dateKey=2026-03-18&limit=50&status=rejected");
  });

  it("describes active audit filters for quick scanning", () => {
    expect(
      buildActiveAuditFilterBadges({
        activeDateKey: "2026-03-18",
        employeeName: "Ali",
        editedFilter: "true",
        attendanceStatusFilter: "incomplete",
        scanResultFilter: "rejected",
      }),
    ).toEqual([
      "Tanggal aktif: 2026-03-18",
      "Nama: Ali",
      "Edited: ya",
      "Attendance: belum check-out",
      "Scan: rejected",
    ]);
  });
});
