import { describe, expect, it } from "vitest";

import {
  buildAttendanceQueryString,
  DEFAULT_ATTENDANCE_FILTERS,
  getAttendanceEditedFilterLabel,
  getAttendanceStatusFilterLabel,
  resolveAttendanceFilters,
  serializeAttendanceFilters,
} from "../lib/attendance-filters";

describe("attendance filters", () => {
  it("resolves missing values to the default daily filters", () => {
    expect(resolveAttendanceFilters()).toEqual(DEFAULT_ATTENDANCE_FILTERS);
    expect(
      resolveAttendanceFilters({
        dateKey: "",
        q: "   ",
        status: "unknown" as never,
        edited: "invalid" as never,
      }),
    ).toEqual(DEFAULT_ATTENDANCE_FILTERS);
  });

  it("trims search terms during normalization", () => {
    expect(
      resolveAttendanceFilters({
        dateKey: DEFAULT_ATTENDANCE_FILTERS.dateKey,
        q: "  Ali  ",
      }),
    ).toMatchObject({
      q: "Ali",
    });
  });

  it("serializes status and edited filters into stable query params", () => {
    const query = serializeAttendanceFilters({
      dateKey: "2026-03-08",
      q: "Siti",
      status: "incomplete",
      edited: "false",
    });

    expect(query).toContain("dateKey=2026-03-08");
    expect(query).toContain("q=Siti");
    expect(query).toContain("status=incomplete");
    expect(query).toContain("edited=false");
  });

  it("builds the attendance fetch query string for the selected day", () => {
    const query = buildAttendanceQueryString(
      {
        dateKey: "2026-03-08",
        q: "  Budi  ",
        status: "checked-in",
        edited: "true",
      },
      "cursor:20",
    );

    expect(query).toContain("dateKey=2026-03-08");
    expect(query).toContain("limit=20");
    expect(query).toContain("cursor=cursor%3A20");
    expect(query).toContain("q=Budi");
    expect(query).toContain("status=checked-in");
    expect(query).toContain("edited=true");
  });

  it("maps attendance filter values into stable menu labels", () => {
    expect(getAttendanceStatusFilterLabel("all")).toBe("Semua");
    expect(getAttendanceStatusFilterLabel("incomplete")).toBe("Belum check-out");
    expect(getAttendanceEditedFilterLabel("all")).toBe("Semua");
    expect(getAttendanceEditedFilterLabel("false")).toBe("Original");
  });
});
