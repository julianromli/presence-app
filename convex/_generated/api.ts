export const api = {} as Record<string, unknown>;

export const internal = {
  reports: {
    markWeeklyReport: 'reports:markWeeklyReport',
    runWeeklyReport: 'reports:runWeeklyReport',
  },
  attendance: {
    listByDateRangeUnsafe: 'attendance:listByDateRangeUnsafe',
  },
} as const;
