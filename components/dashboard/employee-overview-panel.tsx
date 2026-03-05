'use client';

import {
  ArrowsClockwise,
  ChartLineUp,
  CheckCircle,
  ClockCountdown,
  Fire,
  Medal,
} from '@phosphor-icons/react/dist/ssr';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { parseApiErrorResponse } from '@/lib/client-error';
import type { ApiErrorInfo } from '@/lib/client-error';
import { workspaceFetch } from '@/lib/workspace-client';
import type { EmployeeDashboardOverviewPayload } from '@/types/dashboard';

type PanelStatus = 'idle' | 'loading' | 'success' | 'error';

async function fetchOverviewPayload() {
  const res = await workspaceFetch('/api/karyawan/dashboard/overview', { cache: 'no-store' });
  if (!res.ok) {
    throw await parseApiErrorResponse(res, 'Gagal memuat ringkasan personal.');
  }
  return (await res.json()) as EmployeeDashboardOverviewPayload;
}

function formatMinuteToClock(minutes: number | null) {
  if (minutes === null) return '--:--';
  const safe = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function EmployeeOverviewPanel() {
  const [status, setStatus] = useState<PanelStatus>('loading');
  const [payload, setPayload] = useState<EmployeeDashboardOverviewPayload | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  const loadOverview = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const nextPayload = await fetchOverviewPayload();
      setPayload(nextPayload);
      setStatus('success');
    } catch (nextError) {
      setError(nextError as ApiErrorInfo);
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
    return () => window.removeEventListener('dashboard:refresh', handleRefresh as EventListener);
  }, [loadOverview]);

  const chartMaxMinute = useMemo(() => {
    if (!payload) return 9 * 60;
    const minutes = payload.trend14d.filter((point) => point.checkInMinute !== null).map((point) => point.checkInMinute ?? 0);
    return Math.max(8 * 60 + 30, ...minutes);
  }, [payload]);

  if (status === 'loading' && !payload) {
    return (
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array.from({ length: 4 })].map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50" />
      </div>
    );
  }

  if (status === 'error' && error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
        <p className="font-semibold">Ringkasan tidak bisa dimuat</p>
        <p className="mt-1">[{error.code}] {error.message}</p>
        <Button className="mt-4" variant="outline" onClick={() => void loadOverview()}>
          Muat Ulang
        </Button>
      </div>
    );
  }

  if (!payload) return null;

  const cards = payload.cards;
  const badge = payload.badgeProgress;

  return (
    <div className="space-y-6 pb-20">
      <section className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.45)]">
            <div className="flex items-center gap-2 text-zinc-500">
              <ChartLineUp className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-wide">Skor Disiplin</p>
            </div>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900">{cards.disciplineScore}</p>
            <p className="mt-1 text-xs text-zinc-500">Skala 0-100 minggu ini</p>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.45)]">
            <div className="flex items-center gap-2 text-zinc-500">
              <CheckCircle className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-wide">Tepat Waktu</p>
            </div>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900">{cards.onTimeThisWeek}</p>
            <p className="mt-1 text-xs text-zinc-500">{cards.lateThisWeek} hari terlambat minggu ini</p>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.45)]">
            <div className="flex items-center gap-2 text-zinc-500">
              <ClockCountdown className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-wide">Rata-rata Check-in</p>
            </div>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900">{cards.avgCheckInTime}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {cards.improvementMinutes >= 0 ? '+' : '-'}
              {Math.abs(cards.improvementMinutes)} menit dibanding minggu lalu
            </p>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.45)]">
            <div className="flex items-center gap-2 text-zinc-500">
              <Fire className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-wide">Poin & Streak</p>
            </div>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900">{cards.weeklyPoints}</p>
            <p className="mt-1 text-xs text-zinc-500">{cards.streakDays} hari streak tepat waktu</p>
          </article>
        </div>

        <aside className="rounded-2xl border border-zinc-200 bg-zinc-950 p-5 text-zinc-100 shadow-[0_22px_36px_-28px_rgba(2,6,23,0.7)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Badge Progress</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
                {badge.current === 'none' ? 'Belum Ada Badge' : badge.current.toUpperCase()}
              </p>
            </div>
            <Medal className="h-8 w-8 text-emerald-300" />
          </div>
          <p className="mt-3 text-sm text-zinc-300">{payload.insight}</p>
          {badge.next ? (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                <span>Menuju {badge.next.toUpperCase()}</span>
                <span>{badge.currentPoints}/{badge.targetPoints}</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-800">
                <div
                  className="h-2 rounded-full bg-emerald-400 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round((badge.currentPoints / (badge.targetPoints ?? 1)) * 100))}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                Kurang {badge.remainingPoints} poin untuk level berikutnya.
              </p>
            </div>
          ) : (
            <p className="mt-6 text-xs text-emerald-300">Target badge tertinggi sudah tercapai minggu ini.</p>
          )}
        </aside>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.45)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Tren Check-in 14 Hari</h2>
            <p className="text-xs text-zinc-500">Target tepat waktu: sebelum 08:00 WIB</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadOverview()}>
            <ArrowsClockwise className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-2 sm:grid-cols-14">
          {payload.trend14d.map((point) => {
            const height =
              point.checkInMinute === null
                ? 8
                : Math.max(10, Math.min(100, Math.round((point.checkInMinute / chartMaxMinute) * 100)));
            return (
              <div key={point.dateKey} className="flex flex-col items-center gap-2">
                <div className="flex h-28 w-full items-end rounded-md bg-zinc-100 p-1.5">
                  <div
                    className={`w-full rounded-sm transition-colors ${
                      !point.hasCheckIn
                        ? 'bg-zinc-300'
                        : point.onTime
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <p className="text-[10px] font-medium text-zinc-500">
                  {point.dateKey.slice(5)}
                </p>
                <p className="text-[10px] font-semibold text-zinc-700">
                  {formatMinuteToClock(point.checkInMinute)}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
