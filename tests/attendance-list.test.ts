import { describe, expect, it } from "vitest";

import {
  filterAttendanceByEmployeeName,
  paginateFilteredAttendance,
  summarizeAttendanceRows,
} from "../convex/attendanceList";

const rows = [
  {
    _id: "a",
    employeeName: "Budi",
    checkInAt: 1,
    checkOutAt: undefined,
    edited: false,
  },
  {
    _id: "b",
    employeeName: "Alicia",
    checkInAt: 2,
    checkOutAt: 3,
    edited: true,
  },
  {
    _id: "c",
    employeeName: "Alif",
    checkInAt: 4,
    checkOutAt: undefined,
    edited: false,
  },
  {
    _id: "d",
    employeeName: "Siti",
    checkInAt: undefined,
    checkOutAt: undefined,
    edited: false,
  },
  {
    _id: "e",
    employeeName: "Ali Akbar",
    checkInAt: 5,
    checkOutAt: 6,
    edited: true,
  },
];

describe("attendance list helpers", () => {
  it("applies filter-first pagination using deterministic offset cursor", () => {
    const filtered = filterAttendanceByEmployeeName(rows, "ali");
    const firstPage = paginateFilteredAttendance(filtered, {
      numItems: 2,
      cursor: null,
    });

    expect(filtered.map((row) => row._id)).toEqual(["b", "c", "e"]);
    expect(firstPage.page.map((row) => row._id)).toEqual(["b", "c"]);
    expect(firstPage.isDone).toBe(false);
    expect(firstPage.continueCursor).toBe("offset:2");

    const secondPage = paginateFilteredAttendance(filtered, {
      numItems: 2,
      cursor: firstPage.continueCursor,
    });
    expect(secondPage.page.map((row) => row._id)).toEqual(["e"]);
    expect(secondPage.isDone).toBe(true);
    expect(secondPage.continueCursor).toBe("");
  });

  it("summarizes the same filtered dataset used by pagination", () => {
    const filtered = filterAttendanceByEmployeeName(rows, "ali");
    const summary = summarizeAttendanceRows(filtered);

    expect(summary).toEqual({
      total: 3,
      checkedIn: 3,
      checkedOut: 2,
      edited: 2,
    });
  });
});
