'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  PencilLine,
  Sparkles,
} from 'lucide-react';

import { ScanBottomNav } from '@/components/ui/scan-bottom-nav';
import { ScanNotificationsDrawer } from '@/components/ui/scan-notifications-drawer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetDescription, SheetHeader, SheetPanel, SheetPopup, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { parseApiErrorResponse } from '@/lib/client-error';
import type { ApiErrorInfo } from '@/lib/client-error';
import { cn } from '@/lib/utils';
import { workspaceFetch } from '@/lib/workspace-client';
import type { EmployeeAttendanceHistoryPayload, EmployeeAttendanceHistoryRow } from '@/types/dashboard';

type RangeFilter = '7d' | '30d' | '90d';
type PanelStatus = 'loading' | 'ready' | 'error';

const RANGE_OPTIONS: RangeFilter[] = ['7d', '30d', '90d'];

async function fetchAttendancePayload(range: RangeFilter, cursor: string | null) {
  const query = new URLSearchParams();
  query.set('range', range);
  query.set('limit', '12');
  if (cursor) {
    query.set('cursor', cursor);
  }

  const response = await workspaceFetch(`/api/karyawan/dashboard/attendance?${query.toString()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw await parseApiErrorResponse(response, 'Gagal memuat riwayat absensi.');
  }

  return (await response.json()) as EmployeeAttendanceHistoryPayload;
}

function formatDateLabel(dateKey: string) {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateKey;
  }

  return parsed.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTimeLabel(timestamp?: number) {
  if (!timestamp) {
    return '-';
  }

  return new Date(timestamp).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDurationLabel(minutes: number) {
  if (minutes <= 0) {
    return '-';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  if (remainingMinutes === 0) {
    return `${hours}j`;
  }

  return `${hours}j ${remainingMinutes}m`;
}

function statusLabel(status: EmployeeAttendanceHistoryRow['status']) {
  if (status === 'on-time') return 'Tepat waktu';
  if (status === 'late') return 'Terlambat';
  if (status === 'incomplete') return 'Belum lengkap';
  return 'Tidak hadir';
}

function statusBadgeClass(status: EmployeeAttendanceHistoryRow['status']) {
  if (status === 'on-time') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'late') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (status === 'incomplete') return 'bg-sky-100 text-sky-800 border-sky-200';
  return 'bg-zinc-100 text-zinc-600 border-zinc-200';
}

export function HistoryPanel() {
  const [range, setRange] = useState<RangeFilter>('30d');
  const [status, setStatus] = useState<PanelStatus>('loading');
  const [payload, setPayload] = useState<EmployeeAttendanceHistoryPayload | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [selectedRow, setSelectedRow] = useState<EmployeeAttendanceHistoryRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const latestRequestRef = useRef(0);

  const currentCursor = cursorStack[cursorStack.length - 1];

  const loadHistory = useCallback(async (nextRange: RangeFilter, cursor: string | null) => {
    const requestId = ++latestRequestRef.current;
    setStatus('loading');
    setError(null);

    try {
      const nextPayload = await fetchAttendancePayload(nextRange, cursor);
      if (requestId !== latestRequestRef.current) {
        return;
      }
      setPayload(nextPayload);
      setStatus('ready');
    } catch (nextError) {
      if (requestId !== latestRequestRef.current) {
        return;
      }
      setError(nextError as ApiErrorInfo);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      void loadHistory(range, currentCursor);
    });
    return () => cancelAnimationFrame(frameId);
  }, [currentCursor, loadHistory, range]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadHistory(range, currentCursor);
    };

    window.addEventListener('dashboard:refresh', handleRefresh as EventListener);
    return () => window.removeEventListener('dashboard:refresh', handleRefresh as EventListener);
  }, [currentCursor, loadHistory, range]);

  const openDetail = (row: EmployeeAttendanceHistoryRow) => {
    setSelectedRow(row);
    setDrawerOpen(true);
  };

  const changeRange = (nextRange: RangeFilter) => {
    setRange(nextRange);
    setCursorStack([null]);
  };

  const goNext = () => {
    if (!payload?.pageInfo.continueCursor || payload.pageInfo.isDone) {
      return;
    }

    setCursorStack((prev) => [...prev, payload.pageInfo.continueCursor]);
  };

  const goPrev = () => {
    if (cursorStack.length <= 1) {
      return;
    }

    setCursorStack((prev) => prev.slice(0, -1));
  };

  const summary = payload?.summary;
  const rows = payload?.rows ?? [];
  const isLoading = status === 'loading' && !payload;
  const isReloading = status === 'loading' && !!payload;

  return (
    <div className="min-h-screen flex flex-col items-center bg-secondary/30 pb-20">
      <div className="w-full px-6 pt-6 pb-4 flex justify-between items-center bg-background border-b z-20 sticky top-0 md:max-w-md">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">
            Aktivitas Absensi
          </p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Riwayat Scan
          </h1>
        </div>
        <button
          onClick={() => setNotifOpen(true)}
          className="relative w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors group"
        >
          <Bell className="w-5 h-5 text-foreground transition-transform group-active:scale-90" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background ring-offset-0" />
        </button>
      </div>

      <ScanNotificationsDrawer open={notifOpen} onOpenChange={setNotifOpen} />

      <div className="flex-1 w-full max-w-md px-6 py-6 mx-auto space-y-5">
        <Card className="p-4 rounded-[24px] border-border/60 shadow-sm bg-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <CalendarRange className="h-3.5 w-3.5" />
                Filter Periode
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">
                Audit check-in/check-out pribadi
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Menampilkan riwayat absensi sesuai data yang sudah tercatat di sistem.
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full bg-background border-border/60 shrink-0"
              onClick={() => void loadHistory(range, currentCursor)}
              disabled={status === 'loading'}
            >
              <Loader2 className={cn('h-4 w-4', status === 'loading' && 'animate-spin')} />
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => changeRange(option)}
                className={cn(
                  'rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors',
                  range === option
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/60 bg-background text-muted-foreground hover:bg-secondary/70'
                )}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>

          {summary ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Tepat waktu</p>
                <p className="mt-1 text-xl font-bold text-emerald-900">{summary.onTime}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Terlambat</p>
                <p className="mt-1 text-xl font-bold text-amber-900">{summary.late}</p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Belum lengkap</p>
                <p className="mt-1 text-xl font-bold text-sky-900">{summary.incomplete}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-secondary/40 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total baris</p>
                <p className="mt-1 text-xl font-bold text-foreground">{summary.totalRows}</p>
              </div>
            </div>
          ) : null}
        </Card>

        {status === 'error' && error ? (
          <Card className="rounded-[24px] border-rose-200 bg-rose-50 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-rose-900">Riwayat tidak bisa dimuat</p>
                <p className="mt-1 text-sm text-rose-800">[{error.code}] {error.message}</p>
                <Button className="mt-4 rounded-full" variant="outline" onClick={() => void loadHistory(range, currentCursor)}>
                  Coba Lagi
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {isLoading ? (
              [...Array.from({ length: 4 })].map((_, index) => (
                <Card key={index} className="p-4 rounded-[24px] border-border/60 shadow-sm">
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-28" />
                    <div className="grid grid-cols-2 gap-2">
                      <Skeleton className="h-16 w-full rounded-2xl" />
                      <Skeleton className="h-16 w-full rounded-2xl" />
                    </div>
                  </div>
                </Card>
              ))
            ) : rows.length > 0 ? (
              rows.map((row) => (
                <Card
                  key={row.attendanceId}
                  className="p-4 rounded-[24px] border-border/60 shadow-sm cursor-pointer transition-all active:scale-[0.99] hover:bg-secondary/15"
                  onClick={() => openDetail(row)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground">
                            {formatDateLabel(row.dateKey)}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.checkInAt ? 'Check-in dan status kehadiran tersimpan.' : 'Belum ada check-in pada tanggal ini.'}
                          </p>
                        </div>
                        <span className={cn(
                          'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap',
                          statusBadgeClass(row.status)
                        )}>
                          {statusLabel(row.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-border/60 bg-secondary/35 px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Check-in</p>
                          <p className="mt-1 text-base font-bold text-foreground">{formatTimeLabel(row.checkInAt)}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-secondary/35 px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Check-out</p>
                          <p className="mt-1 text-base font-bold text-foreground">{formatTimeLabel(row.checkOutAt)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />
                          <span>Durasi {formatDurationLabel(row.workDurationMinutes)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                            {row.points} poin
                          </span>
                          {row.edited ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
                              <PencilLine className="h-3.5 w-3.5" />
                              Edited
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center text-xs font-semibold text-primary">
                        Lihat detail
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="rounded-[24px] border-border/60 p-8 text-center shadow-sm">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-foreground">Riwayat kosong</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Belum ada data absensi pada rentang yang dipilih.
                </p>
              </Card>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={goPrev}
            disabled={cursorStack.length <= 1 || status === 'loading'}
          >
            Sebelumnya
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={goNext}
            disabled={status === 'loading' || !payload || payload.pageInfo.isDone}
          >
            Berikutnya
          </Button>
        </div>

        {isReloading ? (
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Memperbarui riwayat...
          </div>
        ) : null}
      </div>

      <ScanBottomNav />

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetPopup side="bottom" className="bg-background border-border max-w-md mx-auto overflow-hidden rounded-t-[32px]">
          <SheetHeader className="text-left border-b border-border/50 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-2xl font-bold">
                  {selectedRow ? formatDateLabel(selectedRow.dateKey) : 'Detail riwayat'}
                </SheetTitle>
                <SheetDescription className="mt-1 text-muted-foreground font-medium">
                  Detail absensi yang benar-benar tersedia di sistem.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <SheetPanel className="p-6 space-y-4">
            {selectedRow ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border/60 bg-secondary/35 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                    <span className={cn(
                      'mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                      statusBadgeClass(selectedRow.status)
                    )}>
                      {statusLabel(selectedRow.status)}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-secondary/35 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Poin</p>
                    <p className="mt-2 text-2xl font-bold text-foreground">{selectedRow.points}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-border/60 bg-card p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tanggal</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{formatDateLabel(selectedRow.dateKey)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedRow.dateKey}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border/60 bg-card p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Check-in</p>
                      <p className="mt-2 text-lg font-bold text-foreground">{formatTimeLabel(selectedRow.checkInAt)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Check-out</p>
                      <p className="mt-2 text-lg font-bold text-foreground">{formatTimeLabel(selectedRow.checkOutAt)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border/60 bg-card p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Durasi kerja</p>
                      <p className="mt-2 text-lg font-bold text-foreground">{formatDurationLabel(selectedRow.workDurationMinutes)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Perubahan manual</p>
                      <p className="mt-2 text-lg font-bold text-foreground">{selectedRow.edited ? 'Ya' : 'Tidak'}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </SheetPanel>
        </SheetPopup>
      </Sheet>
    </div>
  );
}
