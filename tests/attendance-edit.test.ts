import { describe, expect, it } from "vitest";

import {
  createAttendanceEditDraft,
  validateAttendanceEditDraft,
} from "../lib/attendance-edit";

describe("attendance edit helpers", () => {
  it("enters edit mode using the row values", () => {
    expect(
      createAttendanceEditDraft({
        _id: "att_1",
        dateKey: "2026-03-08",
        checkInAt: new Date("2026-03-08T08:30:00").getTime(),
        checkOutAt: new Date("2026-03-08T17:15:00").getTime(),
      }),
    ).toEqual({
      attendanceId: "att_1",
      checkInTime: "08:30",
      checkOutTime: "17:15",
      reason: "Koreksi admin",
    });
  });

  it("rejects empty edit reasons", () => {
    expect(
      validateAttendanceEditDraft("2026-03-08", {
        attendanceId: "att_1",
        checkInTime: "08:00",
        checkOutTime: "17:00",
        reason: "   ",
      }),
    ).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Alasan edit wajib diisi.",
    });
  });

  it("blocks check-out before check-in", () => {
    expect(
      validateAttendanceEditDraft("2026-03-08", {
        attendanceId: "att_1",
        checkInTime: "17:00",
        checkOutTime: "08:00",
        reason: "Koreksi jam pulang",
      }),
    ).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Jam pulang tidak boleh lebih awal dari jam datang.",
    });
  });

  it("returns the normalized payload when the draft is valid", () => {
    const result = validateAttendanceEditDraft("2026-03-08", {
      attendanceId: "att_1",
      checkInTime: "08:00",
      checkOutTime: "17:00",
      reason: "  Koreksi shift  ",
    });

    expect(result.ok).toBe(true);
    expect(result.payload).toMatchObject({
      attendanceId: "att_1",
      reason: "Koreksi shift",
    });
    expect(result.payload.checkInAt).toBeTypeOf("number");
    expect(result.payload.checkOutAt).toBeTypeOf("number");
  });
});
