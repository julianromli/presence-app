import { describe, expect, it } from "vitest";

import { deriveAttendanceStatusMeta } from "../lib/attendance-status";

describe("attendance status helpers", () => {
  it("marks rows without check-in as not checked-in", () => {
    expect(
      deriveAttendanceStatusMeta({
        _id: "att_1",
        employeeName: "Ali",
        dateKey: "2026-03-08",
        edited: false,
      }),
    ).toMatchObject({
      key: "not-checked-in",
      label: "Belum check-in",
      tone: "muted",
      edited: false,
    });
  });

  it("marks rows with check-in but no check-out as incomplete", () => {
    expect(
      deriveAttendanceStatusMeta({
        _id: "att_2",
        employeeName: "Siti",
        dateKey: "2026-03-08",
        checkInAt: 10,
        edited: false,
      }),
    ).toMatchObject({
      key: "incomplete",
      label: "Belum check-out",
      tone: "warning",
    });
  });

  it("keeps the edited marker for corrected rows", () => {
    expect(
      deriveAttendanceStatusMeta({
        _id: "att_3",
        employeeName: "Budi",
        dateKey: "2026-03-08",
        checkInAt: 10,
        checkOutAt: 20,
        edited: true,
      }),
    ).toMatchObject({
      key: "completed",
      edited: true,
    });
  });

  it("derives a stable completed display status", () => {
    expect(
      deriveAttendanceStatusMeta({
        _id: "att_4",
        employeeName: "Rina",
        dateKey: "2026-03-08",
        checkInAt: 100,
        checkOutAt: 200,
        edited: false,
      }),
    ).toEqual({
      key: "completed",
      label: "Lengkap",
      tone: "success",
      edited: false,
    });
  });
});
