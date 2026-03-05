'use client';

import { Crown, Medal, TrendUp } from '@phosphor-icons/react/dist/ssr';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { parseApiErrorResponse } from '@/lib/client-error';
import type { ApiErrorInfo } from '@/lib/client-error';
import { workspaceFetch } from '@/lib/workspace-client';
import type { EmployeeLeaderboardPayload } from '@/types/dashboard';

async function fetchLeaderboardPayload() {
  const res = await workspaceFetch('/api/karyawan/dashboard/leaderboard', { cache: 'no-store' });
  if (!res.ok) {
    throw await parseApiErrorResponse(res, 'Gagal memuat leaderboard.');
  }
  return (await res.json()) as EmployeeLeaderboardPayload;
}

function rankAccent(rank: number) {
  if (rank === 1) return 'border-amber-300 bg-amber-50';
  if (rank === 2) return 'border-zinc-300 bg-zinc-100';
  if (rank === 3) return 'border-emerald-300 bg-emerald-50';
  return 'border-zinc-200 bg-white';
}

export function EmployeeLeaderboardPanel() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [payload, setPayload] = useState<EmployeeLeaderboardPayload | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const nextPayload = await fetchLeaderboardPayload();
      setPayload(nextPayload);
      setStatus('ready');
    } catch (nextError) {
      setError(nextError as ApiErrorInfo);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      void load();
    });
    return () => cancelAnimationFrame(frameId);
  }, [load]);

  useEffect(() => {
    const handleRefresh = () => {
      void load();
    };
    window.addEventListener('dashboard:refresh', handleRefresh as EventListener);
    return () => window.removeEventListener('dashboard:refresh', handleRefresh as EventListener);
  }, [load]);

  if (status === 'error' && error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
        <p className="font-semibold">Leaderboard tidak bisa dimuat</p>
        <p className="mt-1">[{error.code}] {error.message}</p>
        <Button className="mt-4" variant="outline" onClick={() => void load()}>
          Coba Lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <section className="rounded-2xl border border-zinc-200 bg-zinc-950 p-5 text-zinc-50 shadow-[0_22px_36px_-28px_rgba(2,6,23,0.7)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Minggu Berjalan</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">{payload?.weekLabel ?? '-'}</h2>
            <p className="mt-2 text-sm text-zinc-300">Papan peringkat dihitung dari ketepatan check-in dan konsistensi checkout.</p>
          </div>
          <TrendUp className="h-7 w-7 text-emerald-300" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <div className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2">
            Posisi kamu: <span className="font-semibold text-zinc-100">{payload?.myRank ? `#${payload.myRank}` : '-'}</span>
          </div>
          <div className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2">
            Poin kamu: <span className="font-semibold text-zinc-100">{payload?.myPoints ?? 0}</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.45)]">
        <h3 className="text-sm font-semibold text-zinc-900">Top 10 Karyawan</h3>
        <div className="mt-3 space-y-2">
          {status === 'loading' ? (
            [...Array.from({ length: 6 })].map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50" />
            ))
          ) : payload && payload.rows.length > 0 ? (
            payload.rows.map((row) => (
              <article
                key={row.userId}
                className={`rounded-xl border p-3 transition ${rankAccent(row.rank)} ${
                  row.isMe ? 'ring-2 ring-emerald-400/60' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-zinc-900 text-sm font-bold text-zinc-50">
                      #{row.rank}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{row.name}</p>
                      <p className="text-xs text-zinc-500">
                        {row.onTimeDays} hari on-time • streak {row.streakDays} hari
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tracking-tight text-zinc-900">{row.points}</p>
                    <p className="text-xs text-zinc-500">score {row.disciplineScore}</p>
                  </div>
                </div>
                {row.rank <= 3 ? (
                  <div className="mt-2 flex items-center gap-1 text-xs font-medium text-zinc-600">
                    {row.rank === 1 ? <Crown className="h-4 w-4 text-amber-500" /> : <Medal className="h-4 w-4 text-emerald-500" />}
                    Top performer minggu ini
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500">
              Belum ada data leaderboard pada minggu ini.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
