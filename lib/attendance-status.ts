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

export type AttendanceStatusFilter =
  | "all"
  | "not-checked-in"
  | "checked-in"
  | "incomplete"
  | "completed";

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

export function filterAttendanceRowsByStatus(
  rows: AttendanceStatusRow[],
  status: AttendanceStatusFilter,
) {
  if (status === "all") {
    return rows;
  }

  return rows.filter((row) => {
    if (status === "not-checked-in") {
      return row.checkInAt === undefined;
    }
    if (status === "checked-in") {
      return row.checkInAt !== undefined;
    }
    if (status === "incomplete") {
      return row.checkInAt !== undefined && row.checkOutAt === undefined;
    }
    return row.checkInAt !== undefined && row.checkOutAt !== undefined;
  });
}
