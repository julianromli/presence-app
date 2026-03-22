import { describe, expect, it, vi } from "vitest";

import {
  buildAttendanceEditAuditHint,
  buildAttendanceFilterBadges,
  buildActiveAuditFilterBadges,
  buildAttendanceSectionCountLabel,
  buildAttendanceSearchParams,
  buildScanEventsFilterBadges,
  buildScanEventsSectionCountLabel,
  buildSectionToggleLabel,
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

  it("splits attendance and scan filter badges so each section keeps its own mental model", () => {
    expect(
      buildAttendanceFilterBadges({
        activeDateKey: "2026-03-18",
        employeeName: "Ali",
        editedFilter: "true",
        attendanceStatusFilter: "incomplete",
      }),
    ).toEqual([
      "Tanggal absensi: 2026-03-18",
      "Nama karyawan: Ali",
      "Status edit: sudah diedit",
      "Status attendance: belum check-out",
    ]);

    expect(
      buildScanEventsFilterBadges({
        activeDateKey: "2026-03-18",
        scanResultFilter: "rejected",
      }),
    ).toEqual([
      "Tanggal scan: 2026-03-18",
      "Hasil scan: ditolak",
    ]);
  });

  it("builds explicit collapse labels and audit guidance copy for the attendance editor", () => {
    expect(buildSectionToggleLabel("Data attendance", true)).toBe(
      "Sembunyikan Data attendance",
    );
    expect(buildSectionToggleLabel("Data attendance", false)).toBe(
      "Tampilkan Data attendance",
    );
    expect(
      buildAttendanceEditAuditHint({
        employeeName: "Ali",
        dateKey: "2026-03-18",
      }),
    ).toBe("Perubahan untuk Ali pada 2026-03-18 akan dicatat ke audit log.");
  });
});
