export async function refreshAttendanceAuditSections({
  loadAttendance,
  loadScanEvents,
}: {
  loadAttendance: () => Promise<void>;
  loadScanEvents: () => Promise<void>;
}) {
  await Promise.all([loadAttendance(), loadScanEvents()]);
}

export function buildAttendanceSearchParams({
  dateKey,
  employeeName,
  editedFilter,
  attendanceStatusFilter,
  cursor,
}: {
  dateKey: string;
  employeeName: string;
  editedFilter: "all" | "true" | "false";
  attendanceStatusFilter:
    | "all"
    | "not-checked-in"
    | "checked-in"
    | "incomplete"
    | "completed";
  cursor: string | null;
}) {
  const params = new URLSearchParams({
    dateKey,
    limit: "25",
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  if (employeeName.trim().length > 0) {
    params.set("q", employeeName.trim());
  }

  if (editedFilter !== "all") {
    params.set("edited", editedFilter);
  }

  if (attendanceStatusFilter !== "all") {
    params.set("status", attendanceStatusFilter);
  }

  return params.toString();
}

export function buildScanEventsSearchParams({
  dateKey,
  scanResultFilter,
}: {
  dateKey: string;
  scanResultFilter: "all" | "accepted" | "rejected";
}) {
  const params = new URLSearchParams({
    dateKey,
    limit: "50",
  });

  if (scanResultFilter !== "all") {
    params.set("status", scanResultFilter);
  }

  return params.toString();
}

export function buildAttendanceSectionCountLabel({
  loadedCount,
  totalCount,
}: {
  loadedCount: number;
  totalCount: number;
}) {
  if (loadedCount >= totalCount) {
    return `${totalCount} baris`;
  }
  return `${loadedCount}/${totalCount} baris dimuat`;
}

export function buildScanEventsSectionCountLabel({
  loadedCount,
  totalCount,
}: {
  loadedCount: number;
  totalCount: number;
}) {
  if (loadedCount >= totalCount) {
    return `${totalCount} event`;
  }
  return `${loadedCount}/${totalCount} event ditampilkan`;
}

export function buildActiveAuditFilterBadges({
  activeDateKey,
  employeeName,
  editedFilter,
  attendanceStatusFilter,
  scanResultFilter,
}: {
  activeDateKey: string;
  employeeName: string;
  editedFilter: "all" | "true" | "false";
  attendanceStatusFilter:
    | "all"
    | "not-checked-in"
    | "checked-in"
    | "incomplete"
    | "completed";
  scanResultFilter: "all" | "accepted" | "rejected";
}) {
  const badges = [`Tanggal aktif: ${activeDateKey}`];

  if (employeeName.trim().length > 0) {
    badges.push(`Nama: ${employeeName.trim()}`);
  }

  if (editedFilter === "true") {
    badges.push("Edited: ya");
  } else if (editedFilter === "false") {
    badges.push("Edited: belum");
  }

  if (attendanceStatusFilter === "not-checked-in") {
    badges.push("Attendance: belum check-in");
  } else if (attendanceStatusFilter === "checked-in") {
    badges.push("Attendance: sudah check-in");
  } else if (attendanceStatusFilter === "incomplete") {
    badges.push("Attendance: belum check-out");
  } else if (attendanceStatusFilter === "completed") {
    badges.push("Attendance: lengkap");
  }

  if (scanResultFilter !== "all") {
    badges.push(`Scan: ${scanResultFilter}`);
  }

  return badges;
}
