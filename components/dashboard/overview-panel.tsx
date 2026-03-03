'use client';

import { Activity, CheckCircle2, Clock3, RefreshCw, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { parseApiErrorResponse } from '@/lib/client-error';
import type { ApiErrorInfo } from '@/lib/client-error';
import type { DashboardOverviewPayload } from '@/types/dashboard';

type PanelStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

function dayLabelFromDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return date.toLocaleDateString('id-ID', { weekday: 'short' });
}

async function fetchOverviewPayload() {
  const res = await fetch('/api/admin/dashboard/overview', { cache: 'no-store' });
  if (!res.ok) {
    const parsed = await parseApiErrorResponse(res, 'Gagal memuat ringkasan dashboard.');
    throw parsed;
  }
  return (await res.json()) as DashboardOverviewPayload;
}

export function OverviewPanel() {
  const searchParams = useSearchParams();
  const quickFilter = (searchParams.get('q') ?? '').trim().toLocaleLowerCase('id-ID');
  const [status, setStatus] = useState<PanelStatus>('loading');
  const [payload, setPayload] = useState<DashboardOverviewPayload | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  const loadOverview = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const nextPayload = await fetchOverviewPayload();
      setPayload(nextPayload);
      setStatus(nextPayload.recentActivity.length === 0 ? 'empty' : 'success');
    } catch (parsedError) {
      setError(parsedError as ApiErrorInfo);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const nextPayload = await fetchOverviewPayload();
        if (cancelled) return;
        setPayload(nextPayload);
        setStatus(nextPayload.recentActivity.length === 0 ? 'empty' : 'success');
      } catch (parsedError) {
        if (cancelled) return;
        setError(parsedError as ApiErrorInfo);
        setStatus('error');
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredActivity = useMemo(() => {
    if (!payload) {
      return [];
    }
    if (quickFilter.length === 0) {
      return payload.recentActivity;
    }

    return payload.recentActivity.filter((item) => {
      const haystack = `${item.employeeName} ${item.dateKey} ${item.status}`.toLocaleLowerCase('id-ID');
      return haystack.includes(quickFilter);
    });
  }, [payload, quickFilter]);

  if (status === 'loading' && !payload) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array.from({ length: 3 })].map((_, idx) => (
          <div key={idx} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
    );
  }

  if (status === 'error' && error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        <p>
          [{error.code}] {error.message}
        </p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => void loadOverview()}>
          Coba Lagi
        </Button>
      </div>
    );
  }

  if (!payload) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Karyawan Aktif</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{payload.cards.activeEmployees}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Hadir Hari Ini</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{payload.cards.presentToday}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Rasio Kehadiran</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{payload.cards.attendanceRatePct}%</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Sudah Check-out</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{payload.cards.checkedOut}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Edit Hari Ini</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{payload.cards.editedToday}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Device QR Online</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{payload.cards.deviceQrOnline}</p>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Tren Kehadiran 7 Hari</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => void loadOverview()}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
          <div className="grid grid-cols-7 items-end gap-2 rounded-lg bg-slate-50 p-4">
            {payload.trend7d.map((point) => {
              const barHeight = Math.max(10, Math.round(point.attendanceRatePct));
              return (
                <div key={point.dateKey} className="flex flex-col items-center gap-2">
                  <div className="flex h-40 w-full items-end justify-center rounded bg-white p-2">
                    <div className="w-full rounded-t bg-slate-900" style={{ height: `${barHeight}%` }} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-slate-700">{dayLabelFromDateKey(point.dateKey)}</p>
                    <p className="text-[10px] text-slate-500">{point.attendanceRatePct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Aktivitas Terkini</h2>
            <p className="text-xs text-slate-500">{filteredActivity.length} item</p>
          </div>

          {status === 'empty' ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Belum ada aktivitas attendance untuk ditampilkan.
            </div>
          ) : filteredActivity.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Tidak ada aktivitas yang cocok dengan filter pencarian.
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredActivity.map((item) => (
                <li key={item.attendanceId} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.employeeName}</p>
                    <p className="text-xs text-slate-500">
                      {item.status === 'check-out' ? 'Check-out' : 'Check-in'} • {item.dateKey}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-700">
                      {new Date(item.happenedAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {item.edited ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        <Clock3 className="h-3 w-3" />
                        Edited
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Normal
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <Users className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-wide">Sumber KPI</p>
          </div>
          <p className="mt-2 text-sm text-slate-700">
            Semua angka diambil dari data attendance dan users terkini pada Convex.
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-slate-500">
            <Activity className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-wide">Status Report Mingguan</p>
          </div>
          {payload.reportStatus ? (
            <div className="mt-2 text-sm text-slate-700">
              <p>
                {payload.reportStatus.weekKey} • <span className="font-semibold">{payload.reportStatus.status}</span>
              </p>
              <p className="text-xs text-slate-500">
                Trigger terakhir:{' '}
                {payload.reportStatus.lastTriggeredAt
                  ? new Date(payload.reportStatus.lastTriggeredAt).toLocaleString('id-ID')
                  : '-'}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Belum ada report mingguan.</p>
          )}
        </article>
      </section>
    </div>
  );
}
