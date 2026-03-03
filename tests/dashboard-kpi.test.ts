import { describe, expect, it } from 'vitest';

import { buildTrendWindow, computeAttendanceRatePct } from '../lib/dashboard-kpi';

describe('dashboard-kpi utils', () => {
  it('computes attendance percentage with one decimal precision', () => {
    expect(computeAttendanceRatePct(47, 100)).toBe(47);
    expect(computeAttendanceRatePct(7, 13)).toBe(53.8);
  });

  it('returns 0 percentage when active employee denominator is zero', () => {
    expect(computeAttendanceRatePct(4, 0)).toBe(0);
  });

  it('maps trend window by ordered date keys', () => {
    const trend = buildTrendWindow(['2026-03-01', '2026-03-02'], { '2026-03-01': 5 }, 10);

    expect(trend).toEqual([
      {
        dateKey: '2026-03-01',
        presentCount: 5,
        attendanceRatePct: 50,
      },
      {
        dateKey: '2026-03-02',
        presentCount: 0,
        attendanceRatePct: 0,
      },
    ]);
  });
});