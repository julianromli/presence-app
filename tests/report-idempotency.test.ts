import { describe, expect, it } from 'vitest';

import { decideWeeklyReportStart } from '../convex/reportIdempotency';

describe('decideWeeklyReportStart', () => {
  it('creates a new pending run when no report exists', () => {
    const decision = decideWeeklyReportStart(null, {
      now: 1000,
      triggerSource: 'manual',
      triggeredBy: 'u1',
      startDate: '2026-03-02',
      endDate: '2026-03-08',
    });

    expect(decision.mode).toBe('create');
    expect(decision.runGeneration).toBe(true);
    expect(decision.status).toBe('pending');
    expect(decision.startedAt).toBe(1000);
    expect(decision.attempts).toBe(1);
    expect(decision.doc.triggerSource).toBe('manual');
    expect(decision.doc.lastTriggeredAt).toBe(1000);
  });

  it('skips generation for an existing success report', () => {
    const decision = decideWeeklyReportStart(
      {
        status: 'success',
        startedAt: 500,
        attempts: 2,
      },
      {
        now: 1200,
        triggerSource: 'cron',
        triggeredBy: undefined,
        startDate: '2026-03-02',
        endDate: '2026-03-08',
      },
    );

    expect(decision.mode).toBe('skip');
    expect(decision.runGeneration).toBe(false);
    expect(decision.status).toBe('success');
    expect(decision.startedAt).toBe(500);
    expect(decision.attempts).toBe(2);
    expect(decision.patch.lastTriggeredAt).toBe(1200);
  });

  it('retries generation for a failed report and increments attempts', () => {
    const decision = decideWeeklyReportStart(
      {
        status: 'failed',
        attempts: 3,
      },
      {
        now: 2000,
        triggerSource: 'manual',
        triggeredBy: 'u2',
        startDate: '2026-03-02',
        endDate: '2026-03-08',
      },
    );

    expect(decision.mode).toBe('retry');
    expect(decision.runGeneration).toBe(true);
    expect(decision.status).toBe('pending');
    expect(decision.startedAt).toBe(2000);
    expect(decision.attempts).toBe(4);
    expect(decision.patch.status).toBe('pending');
    expect(decision.patch.errorMessage).toBeUndefined();
  });
});
