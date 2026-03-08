export type AttendanceStatusRow = {
  _id: string;
  employeeName: string;
  dateKey: string;
  checkInAt?: number;
  checkOutAt?: number;
  edited: boolean;
};

export type AttendanceStatusMeta = {
  key: "not-checked-in" | "incomplete" | "completed";
  label: string;
  tone: "muted" | "warning" | "success";
  edited: boolean;
};

export function deriveAttendanceStatusMeta(row: AttendanceStatusRow): AttendanceStatusMeta {
  if (row.checkInAt === undefined) {
    return {
      key: "not-checked-in",
      label: "Belum check-in",
      tone: "muted",
      edited: row.edited,
    };
  }

  if (row.checkOutAt === undefined) {
    return {
      key: "incomplete",
      label: "Belum check-out",
      tone: "warning",
      edited: row.edited,
    };
  }

  return {
    key: "completed",
    label: "Lengkap",
    tone: "success",
    edited: row.edited,
  };
}
