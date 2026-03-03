'use client';

import { UserButton } from '@clerk/nextjs';
import { ArrowsClockwise, CaretDown, DownloadSimple, SquaresFour } from '@phosphor-icons/react/dist/ssr';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { parseApiErrorResponse } from '@/lib/client-error';

const titleByPathname: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/report': 'Manajemen Kehadiran',
  '/dashboard/users': 'Manajemen Karyawan',
  '/settings/geofence': 'Pengaturan Geofence',
};

function getPageTitle(pathname: string) {
  if (titleByPathname[pathname]) {
    return titleByPathname[pathname];
  }

  if (pathname.startsWith('/dashboard/users')) {
    return 'Manajemen Karyawan';
  }

  return 'Presence';
}

type DashboardTopbarProps = {
  name: string;
  email: string;
};

type WeeklyReportRow = {
  _id: string;
  status: 'pending' | 'success' | 'failed';
};

export function DashboardTopbar({ name, email }: DashboardTopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(new Date());
  const [busy, setBusy] = useState<'none' | 'refresh' | 'report' | 'export'>('none');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const initials = useMemo(() => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), [name]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const dispatchRefresh = () => {
    window.dispatchEvent(new CustomEvent('dashboard:refresh'));
  };

  const refreshDashboard = async () => {
    setBusy('refresh');
    setNotice(null);
    try {
      const res = await fetch('/api/admin/dashboard/overview', { cache: 'no-store' });
      if (!res.ok) {
        const error = await parseApiErrorResponse(res, 'Gagal menyegarkan data dashboard.');
        setNotice({ tone: 'error', text: `[${error.code}] ${error.message}` });
        return;
      }
      setLastUpdatedAt(new Date());
      dispatchRefresh();
      setNotice({ tone: 'success', text: 'Dashboard berhasil diperbarui.' });
    } finally {
      setBusy('none');
    }
  };

  const openSettings = () => {
    router.push('/settings/geofence');
  };

  const runGenerateWeeklyReport = async () => {
    setMenuOpen(false);
    setBusy('report');
    setNotice(null);
    try {
      const res = await fetch('/api/admin/reports', { method: 'POST' });
      if (!res.ok) {
        const error = await parseApiErrorResponse(res, 'Gagal memproses trigger report mingguan.');
        setNotice({ tone: 'error', text: `[${error.code}] ${error.message}` });
        return;
      }
      setLastUpdatedAt(new Date());
      dispatchRefresh();
      setNotice({ tone: 'success', text: 'Trigger report mingguan berhasil dijalankan.' });
    } finally {
      setBusy('none');
    }
  };

  const runExportLatestReport = async () => {
    setMenuOpen(false);
    setBusy('export');
    setNotice(null);
    try {
      const res = await fetch('/api/admin/reports', { cache: 'no-store' });
      if (!res.ok) {
        const error = await parseApiErrorResponse(res, 'Gagal memuat daftar report mingguan.');
        setNotice({ tone: 'error', text: `[${error.code}] ${error.message}` });
        return;
      }
      const reports = (await res.json()) as WeeklyReportRow[];
      const latestSuccess = reports.find((item) => item.status === 'success');
      if (!latestSuccess) {
        setNotice({ tone: 'info', text: 'Belum ada report mingguan berstatus sukses untuk diunduh.' });
        return;
      }
      window.location.assign(`/api/admin/reports/download?reportId=${encodeURIComponent(latestSuccess._id)}`);
    } finally {
      setBusy('none');
    }
  };

  return (
    <header className="z-20 bg-slate-100/95 backdrop-blur">
      <div className="px-4 pt-5 md:px-6">
        <div className="mx-auto w-full max-w-[1400px]">
          <div className="flex items-center justify-between border-b border-slate-300 pb-5">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{getPageTitle(pathname)}</h1>
            <div className="flex items-center gap-3">
              <div className="hidden text-right md:block">
                <p className="text-lg font-semibold text-slate-900">{name}</p>
                <p className="text-sm text-slate-500">{email}</p>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 md:hidden">
                {initials}
              </div>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 md:px-6">
        <div className="mx-auto w-full max-w-[1400px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void refreshDashboard()}
              disabled={busy !== 'none'}
              className="inline-flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowsClockwise
                weight="regular"
                className={`h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`}
              />
              <span>
                Last updated:{' '}
                {lastUpdatedAt.toLocaleDateString('en-US', {
                  month: 'short',
                  day: '2-digit',
                  year: 'numeric',
                })}
              </span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-slate-300 bg-white px-4 text-base font-medium text-slate-600 hover:bg-slate-50"
                onClick={openSettings}
              >
                <SquaresFour weight="regular" className="mr-2 h-4 w-4" />
                View setting
              </Button>

              <div className="relative" ref={menuRef}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl border-slate-300 bg-white px-4 text-base font-medium text-slate-600 hover:bg-slate-50"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  disabled={busy !== 'none'}
                >
                  <DownloadSimple weight="regular" className="mr-2 h-4 w-4" />
                  Import/Export
                  <CaretDown weight="regular" className="ml-2 h-4 w-4" />
                </Button>

                {menuOpen ? (
                  <div className="absolute right-0 top-12 z-30 min-w-64 rounded-xl border border-slate-300 bg-white p-2 shadow-lg">
                    <button
                      type="button"
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                      onClick={() => void runExportLatestReport()}
                    >
                      Export latest weekly report
                    </button>
                    <button
                      type="button"
                      className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                      onClick={() => void runGenerateWeeklyReport()}
                    >
                      Generate weekly report
                    </button>
                    <button
                      type="button"
                      className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                      onClick={() => void refreshDashboard()}
                    >
                      Refresh dashboard data
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {notice ? (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                notice.tone === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : notice.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-blue-200 bg-blue-50 text-blue-900'
              }`}
            >
              {notice.text}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

