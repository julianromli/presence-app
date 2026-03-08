import { describe, expect, it } from "vitest";

import {
  buildAttendanceQueryString,
  DEFAULT_ATTENDANCE_FILTERS,
  resolveAttendanceFilters,
} from "../lib/attendance-filters";
import {
  filterAttendanceRowsByStatus,
  type AttendanceStatusRow,
} from "../lib/attendance-status";

const rows: AttendanceStatusRow[] = [
  {
    _id: "att_1",
    employeeName: "Ali",
    dateKey: "2026-03-08",
    edited: false,
  },
  {
    _id: "att_2",
    employeeName: "Budi",
    dateKey: "2026-03-08",
    checkInAt: 100,
    edited: false,
  },
  {
    _id: "att_3",
    employeeName: "Siti",
    dateKey: "2026-03-08",
    checkInAt: 100,
    checkOutAt: 200,
    edited: true,
  },
];

describe("dashboard users attendance helpers", () => {
  it("builds the default daily attendance query without optional filters", () => {
    const filters = resolveAttendanceFilters();
    const query = buildAttendanceQueryString(filters, null);

    expect(filters).toEqual(DEFAULT_ATTENDANCE_FILTERS);
    expect(query).toContain(`dateKey=${DEFAULT_ATTENDANCE_FILTERS.dateKey}`);
    expect(query).toContain("limit=20");
    expect(query).not.toContain("q=");
    expect(query).not.toContain("edited=");
    expect(query).not.toContain("status=");
  });

  it("filters rows by incomplete and completed attendance status", () => {
    expect(filterAttendanceRowsByStatus(rows, "incomplete").map((row) => row._id)).toEqual(["att_2"]);
    expect(filterAttendanceRowsByStatus(rows, "completed").map((row) => row._id)).toEqual(["att_3"]);
  });

  it("filters rows by not-checked-in status", () => {
    expect(filterAttendanceRowsByStatus(rows, "not-checked-in").map((row) => row._id)).toEqual(["att_1"]);
  });

  it("keeps the full list when status filter is all", () => {
    expect(filterAttendanceRowsByStatus(rows, "all")).toEqual(rows);
  });
});
