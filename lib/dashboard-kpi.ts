export function computeAttendanceRatePct(presentCount: number, activeEmployees: number) {
  if (activeEmployees <= 0) {
    return 0;
  }

  return Number(((presentCount / activeEmployees) * 100).toFixed(1));
}

export function buildTrendWindow(dateKeys: string[], presentByDateKey: Record<string, number>, activeEmployees: number) {
  return dateKeys.map((dateKey) => {
    const presentCount = presentByDateKey[dateKey] ?? 0;
    return {
      dateKey,
      presentCount,
      attendanceRatePct: computeAttendanceRatePct(presentCount, activeEmployees),
    };
  });
}