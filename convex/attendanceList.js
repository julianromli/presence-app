function normalizeKeyword(value) {
  return value?.trim().toLocaleLowerCase("id-ID") ?? "";
}

function includesKeyword(row, keyword) {
  if (!keyword) {
    return true;
  }

  return row.employeeName.toLocaleLowerCase("id-ID").includes(keyword);
}

export function filterAttendanceByEmployeeName(rows, employeeName) {
  const keyword = normalizeKeyword(employeeName);
  return rows.filter((row) => includesKeyword(row, keyword));
}

export function filterAttendanceByStatus(rows, status) {
  if (!status || status === "all") {
    return rows;
  }

  return rows.filter((row) => {
    if (status === "not-checked-in") {
      return row.checkInAt === undefined;
    }
    if (status === "checked-in") {
      return row.checkInAt !== undefined;
    }
    if (status === "incomplete") {
      return row.checkInAt !== undefined && row.checkOutAt === undefined;
    }
    return row.checkInAt !== undefined && row.checkOutAt !== undefined;
  });
}

function parseOffsetCursor(cursor) {
  if (!cursor) {
    return 0;
  }
  if (!cursor.startsWith("offset:")) {
    return 0;
  }

  const offset = Number.parseInt(cursor.slice("offset:".length), 10);
  if (Number.isNaN(offset) || offset < 0) {
    return 0;
  }
  return offset;
}

export function paginateFilteredAttendance(rows, paginationOpts) {
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

export function summarizeAttendanceRows(rows) {
  let checkedIn = 0;
  let checkedOut = 0;
  let edited = 0;

  for (const row of rows) {
    if (row.checkInAt !== undefined) checkedIn += 1;
    if (row.checkOutAt !== undefined) checkedOut += 1;
    if (row.edited) edited += 1;
  }

  return {
    total: rows.length,
    checkedIn,
    checkedOut,
    edited,
  };
}
