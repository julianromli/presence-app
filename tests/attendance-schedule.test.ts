import { describe, expect, it } from 'vitest';

import {
  defaultAttendanceSchedule,
  getScheduleForDateKey,
  parseClockToMinutes,
  resolveCheckInPunctuality,
} from '../convex/employeeDashboardKpi';

describe('attendance schedule helpers', () => {
  it('returns the matching enabled row for a weekday', () => {
    const row = getScheduleForDateKey('2026-03-09', defaultAttendanceSchedule());
    expect(row?.day).toBe('monday');
    expect(row?.enabled).toBe(true);
  });

  it('parses HH:mm into minutes', () => {
    expect(parseClockToMinutes('08:15')).toBe(495);
  });

  it('marks check-in on time when local minutes are before or equal to schedule', () => {
    const checkInAt = new Date('2026-03-09T00:59:00.000Z').getTime();
    const result = resolveCheckInPunctuality({
      dateKey: '2026-03-09',
      checkInAt,
      timezone: 'Asia/Jakarta',
      schedule: defaultAttendanceSchedule(),
    });
    expect(result).toBe('on-time');
  });

  it('marks check-in late when local minutes are after schedule', () => {
    const checkInAt = new Date('2026-03-09T01:30:00.000Z').getTime();
    const result = resolveCheckInPunctuality({
      dateKey: '2026-03-09',
      checkInAt,
      timezone: 'Asia/Jakarta',
      schedule: defaultAttendanceSchedule(),
    });
    expect(result).toBe('late');
  });

  it('returns not-applicable for disabled days', () => {
    const checkInAt = new Date('2026-03-08T01:30:00.000Z').getTime();
    const result = resolveCheckInPunctuality({
      dateKey: '2026-03-08',
      checkInAt,
      timezone: 'Asia/Jakarta',
      schedule: defaultAttendanceSchedule(),
    });
    expect(result).toBe('not-applicable');
  });
});
