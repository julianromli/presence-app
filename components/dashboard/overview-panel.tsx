'use client';

import { ArrowsClockwise, CheckCircle, Clock, Pulse, UsersThree, Info } from '@phosphor-icons/react/dist/ssr';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { parseApiErrorResponse } from '@/lib/client-error';
import type { ApiErrorInfo } from '@/lib/client-error';
import { workspaceFetch } from '@/lib/workspace-client';
import type { DashboardOverviewPayload } from '@/types/dashboard';

type PanelStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

function summaryCard(
  label: string,
  value: number,
  isHero: boolean = false,
  suffix = '',
) {
  return (
    <article className={`relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:shadow-md`}>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <p className={`font-semibold tabular-nums tracking-tight ${isHero ? 'text-4xl text-zinc-900' : 'text-3xl text-zinc-800'}`}>
          {value}
        </p>
        {suffix && <span className="text-sm font-medium text-zinc-500">{suffix}</span>}
      </div>
    </article>
  );
}

function dayLabelFromDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return date.toLocaleDateString('id-ID', { weekday: 'short' });
}

async function fetchOverviewPayload() {
  const res = await workspaceFetch('/api/admin/dashboard/overview', { cache: 'no-store' });
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
    const frameId = requestAnimationFrame(() => {
      void loadOverview();
    });

    return () => cancelAnimationFrame(frameId);
  }, [loadOverview]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadOverview();
    };

    window.addEventListener('dashboard:refresh', handleRefresh as EventListener);
    return () => {
      window.removeEventListener('dashboard:refresh', handleRefresh as EventListener);
    };
  }, [loadOverview]);

  const filteredActivity = useMemo(() => {
    if (!payload) return [];
    if (quickFilter.length === 0) return payload.recentActivity;

    return payload.recentActivity.filter((item) => {
      const haystack = `${item.employeeName} ${item.dateKey} ${item.status}`.toLocaleLowerCase('id-ID');
      return haystack.includes(quickFilter);
    });
  }, [payload, quickFilter]);

  if (status === 'loading' && !payload) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array.from({ length: 3 })].map((_, idx) => (
          <div key={idx} className="h-32 animate-pulse rounded-xl border border-zinc-100 bg-zinc-50/50" />
        ))}
      </div>
    );
  }

  if (status === 'error' && error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-6 text-sm text-rose-900 shadow-sm">
        <p className="font-semibold text-rose-950">Error Loading Dashboard</p>
        <p className="mt-1 text-rose-800/80">[{error.code}] {error.message}</p>
        <Button onClick={() => void loadOverview()} className="mt-4 bg-white text-rose-900 border-rose-200 hover:bg-rose-100 hover:border-rose-300 shadow-sm" variant="outline" size="sm">
          Coba Lagi
        </Button>
      </div>
    );
  }

  if (!payload) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCard('Karyawan aktif', payload.cards.activeEmployees, true)}
        {summaryCard('Hadir hari ini', payload.cards.presentToday, true)}
        {summaryCard('Rasio kehadiran', payload.cards.attendanceRatePct, true, '%')}
        {summaryCard('Device QR online', payload.cards.deviceQrOnline, true)}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">Tren kehadiran 7 hari</h2>
              <p className="text-xs text-zinc-500 mt-1">Berdasarkan data check-in harian</p>
            </div>
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="flex items-center justify-center p-2 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
              title="Refresh Trend"
            >
              <ArrowsClockwise weight="bold" className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 flex items-end justify-between gap-2 md:gap-4 mt-auto rounded-lg border border-dashed border-zinc-200 p-4 bg-zinc-50/30">
            {payload.trend7d.map((point) => {
              const barHeight = Math.max(8, Math.round(point.attendanceRatePct));
              return (
                <div key={point.dateKey} className="group relative flex flex-1 flex-col items-center justify-end">
                  <div className="flex h-40 w-full max-w-[40px] flex-col justify-end">
                    <div className="w-full rounded-md bg-zinc-800 transition-all duration-300 group-hover:bg-indigo-600" style={{ height: `${barHeight}%` }} />
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-xs font-medium text-zinc-700">{dayLabelFromDateKey(point.dateKey)}</p>
                    <p className="mt-0.5 text-[10px] tabular-nums text-zinc-400 font-semibold">{point.attendanceRatePct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-zinc-100 p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">Aktivitas terkini</h2>
              <p className="text-xs text-zinc-500 mt-1">{filteredActivity.length} events detected</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[340px] p-6 pt-4 bg-zinc-50/30">
            {status === 'empty' || filteredActivity.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-white px-6 py-10 text-center text-sm text-zinc-500">
                <Info weight="regular" className="h-8 w-8 mb-3 text-zinc-400" />
                <p>Belum ada aktivitas attendance untuk ditampilkan.</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {filteredActivity.map((item) => (
                  <li key={item.attendanceId} className="group flex items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-zinc-100/80">
                    <div className="flex flex-col">
                      <p className="text-[13px] font-medium text-zinc-900">{item.employeeName}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        <span className={item.status === 'check-out' ? 'text-indigo-600' : 'text-emerald-600 font-medium'}>
                          {item.status === 'check-out' ? 'Check-out' : 'Check-in'}
                        </span>
                        {' '}• {item.dateKey}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <p className="text-xs font-semibold tabular-nums text-zinc-700">
                        {new Date(item.happenedAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {item.edited ? (
                        <span className="mt-1 flex items-center gap-1 rounded bg-zinc-200/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-600">
                          <Clock weight="bold" className="h-2.5 w-2.5" /> Edited
                        </span>
                      ) : (
                        <span className="mt-1 flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-600">
                          <CheckCircle weight="bold" className="h-2.5 w-2.5" /> Normal
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-500">
            <UsersThree weight="bold" className="h-4 w-4 text-zinc-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Sumber KPI</p>
          </div>
          <p className="mt-3 text-[13px] text-zinc-600">
            Semua angka metrik ditarik secara _realtime_ dari data kehadiran pada Server Database.
          </p>
        </article>
        <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-500">
            <Pulse weight="bold" className="h-4 w-4 text-zinc-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Status Report Mingguan</p>
          </div>
          {payload.reportStatus ? (
            <div className="mt-3">
              <p className="text-[13px] text-zinc-700">
                Data Mingguan <span className="font-semibold">{payload.reportStatus.weekKey}</span>{' '}
                <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide
                  ${payload.reportStatus.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}
                `}>
                  {payload.reportStatus.status}
                </span>
              </p>
              <p className="text-[11px] text-zinc-500 mt-2 font-mono">
                Trigger terakhir:{' '}
                {payload.reportStatus.lastTriggeredAt
                  ? new Date(payload.reportStatus.lastTriggeredAt).toLocaleString('id-ID')
                  : '-'}
              </p>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 text-[13px] text-zinc-500">
              <Info weight="bold" className="h-4 w-4 text-zinc-400" /> Belum ada riwayat report mingguan.
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
