'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  Buildings,
  CalendarBlank,
  Clock,
  Medal,
  Sparkle,
  User,
  WarningCircle,
} from '@phosphor-icons/react';

import { ScanBottomNav } from '@/components/ui/scan-bottom-nav';
import {
  ScanNotificationsDrawer,
  useScanNotifications,
} from '@/components/ui/scan-notifications-drawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { normalizeClientError, parseApiErrorResponse } from '@/lib/client-error';
import type { ApiErrorInfo } from '@/lib/client-error';
import { workspaceFetch } from '@/lib/workspace-client';
import type { EmployeeDashboardOverviewPayload } from '@/types/dashboard';

type PanelStatus = 'loading' | 'success' | 'error';

export type ProfilePanelProps = {
  initialProfile: {
    name: string;
    email: string;
    role: 'superadmin' | 'admin' | 'karyawan' | 'device-qr';
    workspaceName: string;
    imageUrl?: string | null;
  };
};

async function fetchOverviewPayload() {
  try {
    const response = await workspaceFetch('/api/karyawan/dashboard/overview', {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw await parseApiErrorResponse(response, 'Gagal memuat ringkasan profil.');
    }

    return (await response.json()) as EmployeeDashboardOverviewPayload;
  } catch (error) {
    throw await normalizeClientError(error, 'Gagal memuat ringkasan profil.');
  }
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) {
    return 'KR';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'KR';
}

function roleLabel(role: ProfilePanelProps['initialProfile']['role']) {
  if (role === 'karyawan') return 'Karyawan';
  if (role === 'admin') return 'Admin';
  if (role === 'superadmin') return 'Superadmin';
  return 'Device QR';
}

export function ProfilePanel({ initialProfile }: ProfilePanelProps) {
  const [status, setStatus] = useState<PanelStatus>('loading');
  const [payload, setPayload] = useState<EmployeeDashboardOverviewPayload | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const latestRequestRef = useRef(0);
  const notifications = useScanNotifications();

  const loadOverview = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setStatus('loading');
    setError(null);

    try {
      const nextPayload = await fetchOverviewPayload();
      if (requestId !== latestRequestRef.current) {
        return;
      }
      setPayload(nextPayload);
      setStatus('success');
    } catch (nextError) {
      if (requestId !== latestRequestRef.current) {
        return;
      }
      setError(nextError as ApiErrorInfo);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    return () => {
      latestRequestRef.current += 1;
    };
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

  const title = `${roleLabel(initialProfile.role)} • ${initialProfile.workspaceName}`;
  const initials = initialsFromName(initialProfile.name);

  return (
    <div className="min-h-screen flex flex-col items-center bg-secondary/30 pb-20">
      <div className="w-full px-6 pt-6 pb-4 flex justify-between items-center bg-background border-b z-10 sticky top-0 md:max-w-md">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">
            Akun Anda
          </p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Profil
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setNotifOpen(true)}
          aria-label={
            notifications.unreadCount > 0
              ? `Notifikasi, ${notifications.unreadCount} belum dibaca`
              : 'Notifikasi'
          }
          className="relative w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors group"
        >
          <Bell
            aria-hidden="true"
            className="w-5 h-5 text-foreground transition-transform group-active:scale-90"
          />
          {notifications.unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground"
            >
              {notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}
            </span>
          ) : null}
        </button>
      </div>

      <ScanNotificationsDrawer
        open={notifOpen}
        onOpenChange={setNotifOpen}
        controller={notifications}
      />

      <div className="flex-1 w-full max-w-md px-6 py-6 mx-auto space-y-6">
        <Card className="p-6 rounded-[24px] border-border shadow-sm flex flex-col items-center bg-card">
          <Avatar className="w-24 h-24 mb-4 border-4 border-background shadow-soft ring-2 ring-primary/20">
            {initialProfile.imageUrl ? (
              <AvatarImage src={initialProfile.imageUrl} alt={initialProfile.name} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold text-foreground text-center">{initialProfile.name}</h2>
          <p className="text-sm font-medium text-muted-foreground text-center">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground text-center">{initialProfile.email}</p>

          {status === 'loading' && !payload ? (
            <div className="w-full grid grid-cols-2 gap-4 mt-6">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : payload ? (
            <div className="w-full grid grid-cols-2 gap-4 mt-6">
              <div className="bg-secondary/50 rounded-2xl p-4 text-center border border-border/50">
                <p className="text-xs text-muted-foreground font-medium mb-1">Skor Disiplin</p>
                <p className="text-2xl font-bold text-foreground">{payload.cards.disciplineScore}</p>
              </div>
              <div className="bg-secondary/50 rounded-2xl p-4 text-center border border-border/50">
                <p className="text-xs text-muted-foreground font-medium mb-1">Tepat Waktu</p>
                <p className="text-2xl font-bold text-success">{payload.cards.onTimeThisWeek}</p>
              </div>
              <div className="bg-secondary/50 rounded-2xl p-4 text-center border border-border/50">
                <p className="text-xs text-muted-foreground font-medium mb-1">Poin Minggu Ini</p>
                <p className="text-2xl font-bold text-foreground">{payload.cards.weeklyPoints}</p>
              </div>
              <div className="bg-secondary/50 rounded-2xl p-4 text-center border border-border/50">
                <p className="text-xs text-muted-foreground font-medium mb-1">Streak</p>
                <p className="text-2xl font-bold text-foreground">{payload.cards.streakDays} <span className="text-xs font-normal">hari</span></p>
              </div>
            </div>
          ) : null}
        </Card>

        {status === 'error' && error ? (
          <Card className="rounded-[24px] border-rose-200 bg-rose-50 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <WarningCircle className="w-5 h-5" weight="fill" />
              </div>
              <div>
                <p className="text-sm font-semibold text-rose-900">Ringkasan profil tidak bisa dimuat</p>
                <p className="mt-1 text-sm text-rose-800">[{error.code}] {error.message}</p>
                <Button className="mt-4 rounded-full" variant="outline" onClick={() => void loadOverview()}>
                  Coba Lagi
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {payload ? (
          <Card className="rounded-[24px] border-border/60 bg-zinc-950 p-5 text-zinc-100 shadow-[0_22px_36px_-28px_rgba(2,6,23,0.7)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Insight Mingguan</p>
                <p className="mt-3 text-lg font-semibold tracking-tight text-zinc-50">{payload.insight}</p>
              </div>
              <Medal className="w-7 h-7 text-emerald-300 shrink-0" weight="fill" />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-zinc-900/70 p-4">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Clock className="w-4 h-4" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide">Rata-rata Check-in</p>
                </div>
                <p className="mt-2 text-xl font-bold text-zinc-50">{payload.cards.avgCheckInTime}</p>
              </div>
              <div className="rounded-2xl bg-zinc-900/70 p-4">
                <div className="flex items-center gap-2 text-zinc-400">
                  <CalendarBlank className="w-4 h-4" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide">Perubahan</p>
                </div>
                <p className="mt-2 text-xl font-bold text-zinc-50">
                  {payload.cards.improvementMinutes >= 0 ? '+' : '-'}
                  {Math.abs(payload.cards.improvementMinutes)}m
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="space-y-3">
          <Card className="rounded-[24px] border-border/60 p-4 shadow-sm bg-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Informasi Pribadi</p>
                <p className="text-xs text-muted-foreground mt-1">Fitur edit data belum tersedia di tab karyawan.</p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                Segera hadir
              </span>
            </div>
          </Card>

          <Card className="rounded-[24px] border-border/60 p-4 shadow-sm bg-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                <Buildings className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Pengaturan Presensi</p>
                <p className="text-xs text-muted-foreground mt-1">Pengaturan lanjutan belum dibuka untuk mode mobile ini.</p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                Segera hadir
              </span>
            </div>
          </Card>

          <Card className="rounded-[24px] border-border/60 p-4 shadow-sm bg-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                <Sparkle className="w-5 h-5" weight="fill" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Badge Mingguan</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {payload
                    ? payload.badgeProgress.current === 'none'
                      ? 'Belum ada badge aktif minggu ini.'
                      : `Badge aktif: ${payload.badgeProgress.current.toUpperCase()}.`
                    : 'Memuat progres badge.'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ScanBottomNav />
    </div>
  );
}


