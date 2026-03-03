import { describe, expect, it } from 'vitest';

import { normalizeReportStatus, toHappenedAt } from '../convex/dashboardOverviewShape';

describe('dashboard overview payload shaping', () => {
  it('normalizes valid report status values', () => {
    const normalized = normalizeReportStatus({
      weekKey: '2026-03-02_2026-03-08',
      status: 'success',
      generatedAt: 1000,
      lastTriggeredAt: 1200,
    });

    expect(normalized).toEqual({
      weekKey: '2026-03-02_2026-03-08',
      status: 'success',
      generatedAt: 1000,
      lastTriggeredAt: 1200,
    });
  });

  it('returns null for invalid report status', () => {
    const normalized = normalizeReportStatus({
      weekKey: '2026-03-02_2026-03-08',
      status: 'running',
      generatedAt: 1000,
      lastTriggeredAt: 1200,
    });

    expect(normalized).toBeNull();
  });

  it('derives happenedAt from checkout, then checkin, then update timestamps', () => {
    expect(toHappenedAt({ checkOutAt: 300, checkInAt: 200, updatedAt: 100 })).toBe(300);
    expect(toHappenedAt({ checkInAt: 200, updatedAt: 100 })).toBe(200);
    expect(toHappenedAt({ updatedAt: 100 })).toBe(100);
  });

  it('falls back to 0 when timestamps are missing or invalid', () => {
    expect(toHappenedAt({})).toBe(0);
    expect(toHappenedAt({ checkInAt: NaN, updatedAt: Number.POSITIVE_INFINITY })).toBe(0);
  });
});
