'use node';

import { v } from 'convex/values';
import * as XLSX from 'xlsx';

import { internal } from './_generated/api';
import { internalAction } from './_generated/server';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function getWeekRange(now = new Date()) {
  const day = now.getUTCDay() || 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { monday, sunday };
}

export const runWeeklyReport = internalAction({
  args: {},
  returns: v.object({
    weekKey: v.string(),
    status: v.string(),
  }),
  handler: async (ctx) => {
    const { monday, sunday } = getWeekRange(new Date());
    const weekKey = `${formatDate(monday)}_${formatDate(sunday)}`;

    await ctx.runMutation(internal.reports.markWeeklyReport, {
      weekKey,
      startDate: formatDate(monday),
      endDate: formatDate(sunday),
      status: 'pending',
    });

    try {
      const rows = await ctx.runQuery(internal.attendance.listByDateRangeUnsafe, {
        startDateKey: formatDate(monday),
        endDateKey: formatDate(sunday),
      });

      const worksheetData = rows.map((row) => ({
        'Minggu Ke-': weekKey,
        'Nama Karyawan': row.employeeName,
        'Jam Datang': row.checkInAt ? new Date(row.checkInAt).toISOString() : '-',
        'Jam Pulang': row.checkOutAt ? new Date(row.checkOutAt).toISOString() : '-',
        'Tanggal Kehadiran': row.dateKey,
        'Edited atau Tidak': row.edited ? 'Edited' : 'Tidak',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(wb, ws, 'Presence');
      const fileArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const fileBlob = new Blob([fileArrayBuffer], { type: XLSX_MIME });
      const storageId = await ctx.storage.store(fileBlob);
      const fileUrl = await ctx.storage.getUrl(storageId);
      const fileName = `presence_${weekKey}.xlsx`;

      await ctx.runMutation(internal.reports.markWeeklyReport, {
        weekKey,
        startDate: formatDate(monday),
        endDate: formatDate(sunday),
        status: 'success',
        fileUrl: fileUrl ?? undefined,
        storageId,
        fileName,
        mimeType: XLSX_MIME,
        byteLength: fileBlob.size,
      });

      return { weekKey, status: 'success' };
    } catch (error) {
      await ctx.runMutation(internal.reports.markWeeklyReport, {
        weekKey,
        startDate: formatDate(monday),
        endDate: formatDate(sunday),
        status: 'failed',
        errorMessage: String(error),
      });

      return { weekKey, status: 'failed' };
    }
  },
});
