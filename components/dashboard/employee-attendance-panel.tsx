'use client';

import { CaretLeft, CaretRight } from '@phosphor-icons/react/dist/ssr';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { parseApiErrorResponse } from '@/lib/client-error';
import type { ApiErrorInfo } from '@/lib/client-error';
import { workspaceFetch } from '@/lib/workspace-client';
import type { EmployeeAttendanceHistoryPayload } from '@/types/dashboard';

type RangeFilter = '7d' | '30d' | '90d';

function statusBadgeClass(status: string) {
  if (status === 'on-time') return 'bg-emerald-100 text-emerald-700';
  if (status === 'late') return 'bg-amber-100 text-amber-800';
  if (status === 'incomplete') return 'bg-sky-100 text-sky-800';
  return 'bg-zinc-100 text-zinc-600';
}

function formatTime(ts?: number) {
  if (!ts) return '-';
  return new Date(ts).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(minutes: number) {
  if (minutes <= 0) return '-';
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  if (hour === 0) return `${minute}m`;
  return `${hour}j ${minute}m`;
}

async function fetchAttendancePayload(range: RangeFilter, cursor: string | null) {
  const query = new URLSearchParams();
  query.set('range', range);
  query.set('limit', '12');
  if (cursor) query.set('cursor', cursor);
  const res = await workspaceFetch(`/api/karyawan/dashboard/attendance?${query.toString()}`, { cache: 'no-store' });
  if (!res.ok) {
    throw await parseApiErrorResponse(res, 'Gagal memuat riwayat absensi.');
  }
  return (await res.json()) as EmployeeAttendanceHistoryPayload;
}

export function EmployeeAttendancePanel() {
  const [range, setRange] = useState<RangeFilter>('30d');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [payload, setPayload] = useState<EmployeeAttendanceHistoryPayload | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const latestRequestRef = useRef(0);
  const currentCursor = cursorStack[cursorStack.length - 1];

  const load = useCallback(async (nextRange: RangeFilter, cursor: string | null) => {
    const requestId = ++latestRequestRef.current;
    setStatus('loading');
    setError(null);
    try {
      const next = await fetchAttendancePayload(nextRange, cursor);
      if (requestId !== latestRequestRef.current) return;
      setPayload(next);
      setStatus('ready');
    } catch (nextError) {
      if (requestId !== latestRequestRef.current) return;
      setError(nextError as ApiErrorInfo);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      void load(range, currentCursor);
    });
    return () => cancelAnimationFrame(frameId);
  }, [load, range, currentCursor]);

  useEffect(() => {
    const handleRefresh = () => {
      void load(range, currentCursor);
    };
    window.addEventListener('dashboard:refresh', handleRefresh as EventListener);
    return () => window.removeEventListener('dashboard:refresh', handleRefresh as EventListener);
  }, [load, range, currentCursor]);

  const summary = useMemo(() => payload?.summary, [payload]);

  const changeRange = (nextRange: RangeFilter) => {
    setRange(nextRange);
    setCursorStack([null]);
  };

  const goNext = () => {
    if (!payload?.pageInfo.continueCursor || payload.pageInfo.isDone) return;
    setCursorStack((prev) => [...prev, payload.pageInfo.continueCursor]);
  };

  const goPrev = () => {
    if (cursorStack.length <= 1) return;
    setCursorStack((prev) => prev.slice(0, -1));
  };

  if (status === 'error' && error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
        <p className="font-semibold">Riwayat tidak bisa dimuat</p>
        <p className="mt-1">[{error.code}] {error.message}</p>
        <Button className="mt-4" variant="outline" onClick={() => void load(range, currentCursor)}>
          Coba Lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Riwayat Absensi Personal</h2>
            <p className="text-xs text-zinc-500">Filter periode untuk audit ketepatan check-in/check-out</p>
          </div>
          <div className="flex items-center gap-2">
            {(['7d', '30d', '90d'] as RangeFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => changeRange(item)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  range === item
                    ? 'bg-zinc-900 text-zinc-50'
                    : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {summary ? (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">On-time: <span className="font-semibold text-zinc-900">{summary.onTime}</span></div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">Late: <span className="font-semibold text-zinc-900">{summary.late}</span></div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">Incomplete: <span className="font-semibold text-zinc-900">{summary.incomplete}</span></div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">Absent: <span className="font-semibold text-zinc-900">{summary.absent}</span></div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">Rows: <span className="font-semibold text-zinc-900">{summary.totalRows}</span></div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.45)]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Tanggal</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Check-out</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Durasi</TableHead>
              <TableHead>Poin</TableHead>
              <TableHead>Edited</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {status === 'loading' ? (
              [...Array.from({ length: 5 })].map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={7}>
                    <div className="h-7 animate-pulse rounded bg-zinc-100" />
                  </TableCell>
                </TableRow>
              ))
            ) : payload && payload.rows.length > 0 ? (
              payload.rows.map((row) => (
                <TableRow key={row.attendanceId}>
                  <TableCell className="font-medium text-zinc-900">{row.dateKey}</TableCell>
                  <TableCell>{formatTime(row.checkInAt)}</TableCell>
                  <TableCell>{formatTime(row.checkOutAt)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(row.status)}`}>
                      {row.status}
                    </span>
                  </TableCell>
                  <TableCell>{formatDuration(row.workDurationMinutes)}</TableCell>
                  <TableCell className="font-semibold text-zinc-900">{row.points}</TableCell>
                  <TableCell>{row.edited ? 'Ya' : '-'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="py-8 text-center text-sm text-zinc-500">Belum ada data absensi pada rentang ini.</div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={goPrev} disabled={cursorStack.length <= 1 || status === 'loading'}>
          <CaretLeft className="mr-1 h-4 w-4" /> Prev
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={goNext} disabled={status === 'loading' || !payload || payload.pageInfo.isDone}>
          Next <CaretRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
