export type AttendanceEditSourceRow = {
  _id: string;
  dateKey: string;
  checkInAt?: number;
  checkOutAt?: number;
};

export type AttendanceEditDraft = {
  attendanceId: string | null;
  checkInTime: string;
  checkOutTime: string;
  reason: string;
};

type AttendanceEditValidationSuccess = {
  ok: true;
  payload: {
    attendanceId: string;
    checkInAt?: number;
    checkOutAt?: number;
    reason: string;
  };
};

type AttendanceEditValidationFailure = {
  ok: false;
  code: "VALIDATION_ERROR";
  message: string;
};

export type AttendanceEditValidationResult =
  | AttendanceEditValidationSuccess
  | AttendanceEditValidationFailure;

function formatTimeInput(value?: number) {
  if (value === undefined) return "";
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function buildTimestampFromDateKeyAndTime(baseDateKey: string, hhmm: string) {
  if (!hhmm) return undefined;
  const [hoursRaw, minutesRaw] = hhmm.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return undefined;
  }

  const date = new Date(`${baseDateKey}T00:00:00`);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

export function createAttendanceEditDraft(
  row: AttendanceEditSourceRow,
): AttendanceEditDraft {
  return {
    attendanceId: row._id,
    checkInTime: formatTimeInput(row.checkInAt),
    checkOutTime: formatTimeInput(row.checkOutAt),
    reason: "Koreksi admin",
  };
}

export function createEmptyAttendanceEditDraft(): AttendanceEditDraft {
  return {
    attendanceId: null,
    checkInTime: "",
    checkOutTime: "",
    reason: "Koreksi admin",
  };
}

export function validateAttendanceEditDraft(
  dateKey: string,
  draft: AttendanceEditDraft,
): AttendanceEditValidationResult {
  const attendanceId = draft.attendanceId?.trim();
  const reason = draft.reason.trim();

  if (!attendanceId) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "attendanceId wajib diisi.",
    };
  }

  if (!reason) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Alasan edit wajib diisi.",
    };
  }

  const checkInAt = buildTimestampFromDateKeyAndTime(dateKey, draft.checkInTime);
  const checkOutAt = buildTimestampFromDateKeyAndTime(dateKey, draft.checkOutTime);

  if (
    checkInAt !== undefined &&
    checkOutAt !== undefined &&
    checkOutAt < checkInAt
  ) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Jam pulang tidak boleh lebih awal dari jam datang.",
    };
  }

  return {
    ok: true,
    payload: {
      attendanceId,
      checkInAt,
      checkOutAt,
      reason,
    },
  };
}
