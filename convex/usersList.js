const ROLE_KEYS = ["superadmin", "admin", "karyawan", "device-qr"];

function normalizeKeyword(q) {
  return q?.trim().toLocaleLowerCase("id-ID") ?? "";
}

function includesKeyword(row, keyword) {
  if (!keyword) {
    return true;
  }
  const haystack = `${row.name} ${row.email}`.toLocaleLowerCase("id-ID");
  return haystack.includes(keyword);
}

export function filterUsers(rows, filters) {
  const keyword = normalizeKeyword(filters.q);
  return rows.filter((row) => {
    if (filters.role !== undefined && row.role !== filters.role) {
      return false;
    }
    if (filters.isActive !== undefined && row.isActive !== filters.isActive) {
      return false;
    }
    return includesKeyword(row, keyword);
  });
}

export function summarizeUsers(rows) {
  return {
    total: rows.length,
    active: rows.filter((row) => row.isActive).length,
    inactive: rows.filter((row) => !row.isActive).length,
  };
}

function parseOffsetCursor(cursor) {
  if (!cursor) {
    return 0;
  }
  if (!cursor.startsWith("offset:")) {
    return 0;
  }
  const parsed = Number.parseInt(cursor.slice("offset:".length), 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

export function paginateFilteredRows(rows, paginationOpts) {
  const offset = parseOffsetCursor(paginationOpts.cursor);
  const limit = Math.max(1, paginationOpts.numItems ?? 20);
  const page = rows.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const isDone = nextOffset >= rows.length;

  return {
    page,
    isDone,
    continueCursor: isDone ? "" : `offset:${nextOffset}`,
  };
}

export function emptyUsersMetrics(now = Date.now()) {
  return {
    key: "global",
    total: 0,
    active: 0,
    inactive: 0,
    byRole: Object.fromEntries(
      ROLE_KEYS.map((role) => [role, { total: 0, active: 0 }]),
    ),
    updatedAt: now,
  };
}

export function buildUsersMetricsFromRows(rows, now = Date.now()) {
  const metrics = emptyUsersMetrics(now);
  for (const row of rows) {
    metrics.total += 1;
    if (row.isActive) {
      metrics.active += 1;
    } else {
      metrics.inactive += 1;
    }
    metrics.byRole[row.role].total += 1;
    if (row.isActive) {
      metrics.byRole[row.role].active += 1;
    }
  }
  return metrics;
}

export function summarizeFromMetrics(metrics, filters) {
  const role = filters.role;
  const isActive = filters.isActive;

  if (!role && isActive === undefined) {
    return {
      total: metrics.total,
      active: metrics.active,
      inactive: metrics.inactive,
    };
  }

  if (role && isActive === undefined) {
    const roleCount = metrics.byRole[role];
    return {
      total: roleCount.total,
      active: roleCount.active,
      inactive: roleCount.total - roleCount.active,
    };
  }

  if (!role && isActive !== undefined) {
    const total = isActive ? metrics.active : metrics.inactive;
    return {
      total,
      active: isActive ? total : 0,
      inactive: isActive ? 0 : total,
    };
  }

  const roleCount = metrics.byRole[role];
  const total = isActive ? roleCount.active : roleCount.total - roleCount.active;
  return {
    total,
    active: isActive ? total : 0,
    inactive: isActive ? 0 : total,
  };
}
