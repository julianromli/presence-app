export type AttendanceScheduleDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type AttendanceScheduleRow = {
  day: AttendanceScheduleDay;
  enabled: boolean;
  checkInTime?: string;
};

export type AttendanceScheduleDraftRow = {
  day: AttendanceScheduleDay;
  label: string;
  enabled: boolean;
  checkInTime: string;
};

const DAY_LABELS: Record<AttendanceScheduleDay, string> = {
  monday: 'Senin',
  tuesday: 'Selasa',
  wednesday: 'Rabu',
  thursday: 'Kamis',
  friday: 'Jumat',
  saturday: 'Sabtu',
  sunday: 'Minggu',
};

export const ATTENDANCE_SCHEDULE_DAYS: AttendanceScheduleDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export function defaultAttendanceScheduleRows(): AttendanceScheduleRow[] {
  return [
    { day: 'monday', enabled: true, checkInTime: '08:00' },
    { day: 'tuesday', enabled: true, checkInTime: '08:00' },
    { day: 'wednesday', enabled: true, checkInTime: '08:00' },
    { day: 'thursday', enabled: true, checkInTime: '08:00' },
    { day: 'friday', enabled: true, checkInTime: '08:00' },
    { day: 'saturday', enabled: false },
    { day: 'sunday', enabled: false },
  ];
}

export function buildAttendanceScheduleDraft(
  rows: AttendanceScheduleRow[] = defaultAttendanceScheduleRows(),
): AttendanceScheduleDraftRow[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));

  return ATTENDANCE_SCHEDULE_DAYS.map((day) => {
    const row = byDay.get(day);
    return {
      day,
      label: DAY_LABELS[day],
      enabled: row?.enabled ?? false,
      checkInTime: row?.checkInTime ?? '08:00',
    };
  });
}

export function serializeAttendanceScheduleDraft(
  rows: AttendanceScheduleDraftRow[],
): AttendanceScheduleRow[] {
  return rows.map((row) =>
    row.enabled
      ? {
          day: row.day,
          enabled: true,
          checkInTime: row.checkInTime,
        }
      : {
          day: row.day,
          enabled: false,
        },
  );
}
