import { describe, expect, it } from 'vitest';

import {
  computeDisciplineScore,
  computeDailyPoints,
  computeStreakBonus,
  defaultAttendanceSchedule,
  getMinutesInTimezone,
  resolveCheckInPunctuality,
} from '../convex/employeeDashboardKpi';

describe('employee dashboard kpi', () => {
  it('resolves punctuality from the configured weekday schedule', () => {
    const checkInAt = new Date('2026-03-10T02:05:00.000Z').getTime(); // 09:05 WIB

    expect(
      resolveCheckInPunctuality({
        dateKey: '2026-03-10',
        checkInAt,
        timezone: 'Asia/Jakarta',
        schedule: [
          { day: 'monday', enabled: true, checkInTime: '08:00' },
          { day: 'tuesday', enabled: true, checkInTime: '09:15' },
          { day: 'wednesday', enabled: true, checkInTime: '08:00' },
          { day: 'thursday', enabled: true, checkInTime: '08:00' },
          { day: 'friday', enabled: true, checkInTime: '08:00' },
          { day: 'saturday', enabled: false },
          { day: 'sunday', enabled: false },
        ],
      }),
    ).toBe('on-time');
  });

  it('awards on-time points using the configured weekday schedule', () => {
    const checkInAt = new Date('2026-03-10T02:05:00.000Z').getTime(); // 09:05 WIB
    const checkOutAt = new Date('2026-03-10T09:00:00.000Z').getTime();

    expect(
      computeDailyPoints(
        {
          dateKey: '2026-03-10',
          checkInAt,
          checkOutAt,
        },
        'Asia/Jakarta',
        [
          { day: 'monday', enabled: true, checkInTime: '08:00' },
          { day: 'tuesday', enabled: true, checkInTime: '09:15' },
          { day: 'wednesday', enabled: true, checkInTime: '08:00' },
          { day: 'thursday', enabled: true, checkInTime: '08:00' },
          { day: 'friday', enabled: true, checkInTime: '08:00' },
          { day: 'saturday', enabled: false },
          { day: 'sunday', enabled: false },
        ],
      ),
    ).toBe(14);
  });

  it('returns not-applicable punctuality for disabled schedule days', () => {
    const checkInAt = new Date('2026-03-08T01:30:00.000Z').getTime();

    expect(
      resolveCheckInPunctuality({
        dateKey: '2026-03-08',
        checkInAt,
        timezone: 'Asia/Jakarta',
        schedule: defaultAttendanceSchedule(),
      }),
    ).toBe('not-applicable');
  });

  it('computes streak bonus every 3 consecutive on-time days', () => {
    expect(computeStreakBonus([true, true, true, false])).toBe(5);
    expect(computeStreakBonus([true, true, true, true, true, true])).toBe(10);
  });

  it('normalizes discipline score into 0-100 range', () => {
    expect(computeDisciplineScore(0, 5)).toBe(0);
    expect(computeDisciplineScore(70, 5)).toBeGreaterThan(0);
    expect(computeDisciplineScore(999, 5)).toBe(100);
  });

  it('extracts minutes correctly by timezone', () => {
    const ts = new Date('2026-03-05T00:30:00.000Z').getTime();
    expect(getMinutesInTimezone(ts, 'Asia/Jakarta')).toBe(7 * 60 + 30);
  });

  it('falls back safely when timezone is invalid', () => {
    const ts = new Date('2026-03-05T00:30:00.000Z').getTime();
    expect(getMinutesInTimezone(ts, 'Invalid/Timezone')).toBe(7 * 60 + 30);
  });
});
