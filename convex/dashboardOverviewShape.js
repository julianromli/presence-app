const ALLOWED_REPORT_STATUSES = new Set(["pending", "success", "failed"]);

function asFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function toHappenedAt(row) {
  const values = [row.checkOutAt, row.checkInAt, row.updatedAt];
  for (const value of values) {
    const next = asFiniteNumber(value);
    if (next !== undefined) {
      return next;
    }
  }
  return 0;
}

export function normalizeReportStatus(report) {
  if (!report) {
    return null;
  }

  if (!ALLOWED_REPORT_STATUSES.has(report.status)) {
    return null;
  }

  return {
    weekKey: report.weekKey,
    status: report.status,
    generatedAt: asFiniteNumber(report.generatedAt),
    lastTriggeredAt: asFiniteNumber(report.lastTriggeredAt),
  };
}
