export function decideWeeklyReportStart(existing, input) {
  const { now, triggerSource, triggeredBy, startDate, endDate } = input;

  if (!existing) {
    return {
      mode: 'create',
      status: 'pending',
      startedAt: now,
      attempts: 1,
      runGeneration: true,
      doc: {
        startDate,
        endDate,
        status: 'pending',
        generatedAt: undefined,
        errorMessage: undefined,
        fileUrl: undefined,
        storageId: undefined,
        fileName: undefined,
        mimeType: undefined,
        byteLength: undefined,
        startedAt: now,
        finishedAt: undefined,
        durationMs: undefined,
        triggerSource,
        triggeredBy,
        lastTriggeredAt: now,
        attempts: 1,
      },
    };
  }

  if (existing.status === 'success' || existing.status === 'pending') {
    return {
      mode: 'skip',
      status: existing.status,
      startedAt: existing.startedAt ?? now,
      attempts: existing.attempts ?? 1,
      runGeneration: false,
      patch: {
        lastTriggeredAt: now,
        triggerSource,
        triggeredBy,
      },
    };
  }

  const attempts = (existing.attempts ?? 0) + 1;
  return {
    mode: 'retry',
    status: 'pending',
    startedAt: now,
    attempts,
    runGeneration: true,
    patch: {
      startDate,
      endDate,
      status: 'pending',
      errorMessage: undefined,
      fileUrl: undefined,
      storageId: undefined,
      fileName: undefined,
      mimeType: undefined,
      byteLength: undefined,
      startedAt: now,
      finishedAt: undefined,
      durationMs: undefined,
      triggerSource,
      triggeredBy,
      lastTriggeredAt: now,
      attempts,
    },
  };
}
