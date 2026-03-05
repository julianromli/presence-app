import { describe, expect, it } from 'vitest';

import {
  computeDisciplineScore,
  computeStreakBonus,
  getMinutesInTimezone,
  isOnTimeCheckIn,
} from '../convex/employeeDashboardKpi';

describe('employee dashboard kpi', () => {
  it('marks on-time check-in based on fixed cutoff', () => {
    const checkInAt = new Date('2026-03-05T00:59:00.000Z').getTime(); // 07:59 WIB
    const lateCheckInAt = new Date('2026-03-05T01:01:00.000Z').getTime(); // 08:01 WIB

    expect(isOnTimeCheckIn(checkInAt, 'Asia/Jakarta', 8 * 60)).toBe(true);
    expect(isOnTimeCheckIn(lateCheckInAt, 'Asia/Jakarta', 8 * 60)).toBe(false);
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
});

