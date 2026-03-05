'use client';

import { UserButton } from '@clerk/nextjs';
import {
  ArrowsClockwise,
  CaretDown,
  ClockCounterClockwise,
  DownloadSimple,
  FileArrowDown,
  SquaresFour,
} from '@phosphor-icons/react/dist/ssr';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { parseApiErrorResponse } from '@/lib/client-error';
import {
  recoverWorkspaceScopeViolation,
  setActiveWorkspaceIdInBrowser,
  workspaceFetch,
} from '@/lib/workspace-client';

type DashboardHeaderProps = {
  role: string;
  name: string;
  email: string;
};

type WeeklyReportRow = {
  _id: string;
  status: 'pending' | 'success' | 'failed';
};

type WorkspaceMembership = {
  workspace: {
    _id: string;
    name: string;
    slug: string;
  };
  role: 'superadmin' | 'admin' | 'karyawan' | 'device-qr';
};

type WorkspaceMembershipsResponse = {
  memberships: WorkspaceMembership[];
  activeWorkspaceId: string | null;
};

export function DashboardHeader({ role, name, email }: DashboardHeaderProps) {
  const router = useRouter();
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(new Date());
  const [busy, setBusy] = useState<'none' | 'refresh' | 'report' | 'export'>('none');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceSwitching, setWorkspaceSwitching] = useState(false);
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
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
    let cancelled = false;
    const loadMemberships = async () => {
      setWorkspaceLoading(true);
      try {
        const res = await workspaceFetch('/api/workspaces/memberships', { cache: 'no-store' });
        if (!res.ok) {
          return;
        }

        const payload = (await res.json()) as WorkspaceMembershipsResponse;
        if (cancelled) {
          return;
        }
        setMemberships(payload.memberships);
        setActiveWorkspaceId(payload.activeWorkspaceId);
      } finally {
        if (!cancelled) {
          setWorkspaceLoading(false);
        }
      }
    };

    void loadMemberships();
    return () => {
      cancelled = true;
    };
  }, []);

  const dispatchRefresh = () => {
    window.dispatchEvent(new CustomEvent('dashboard:refresh'));
  };

  const refreshDashboard = async () => {
    setBusy('refresh');
    setNotice(null);
    try {
      const res = await workspaceFetch('/api/admin/dashboard/overview', { cache: 'no-store' });
      if (!res.ok) {
        const error = await parseApiErrorResponse(res, 'Gagal menyegarkan data dashboard.');
        if (recoverWorkspaceScopeViolation(error.code)) {
          return;
        }
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

  const handleWorkspaceChange = async (nextWorkspaceId: string) => {
    if (!nextWorkspaceId || nextWorkspaceId === activeWorkspaceId) {
      return;
    }

    setWorkspaceSwitching(true);
    setNotice(null);
    try {
      const res = await workspaceFetch('/api/workspaces/active', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId: nextWorkspaceId }),
      });
      if (!res.ok) {
        const error = await parseApiErrorResponse(res, 'Gagal mengganti workspace aktif.');
        if (recoverWorkspaceScopeViolation(error.code)) {
          return;
        }
        setNotice({ tone: 'error', text: `[${error.code}] ${error.message}` });
        return;
      }

      setActiveWorkspaceId(nextWorkspaceId);
      setActiveWorkspaceIdInBrowser(nextWorkspaceId);
      window.dispatchEvent(
        new CustomEvent('workspace:changed', {
          detail: { workspaceId: nextWorkspaceId },
        }),
      );
      setLastUpdatedAt(new Date());
      dispatchRefresh();
      router.refresh();
      setNotice({ tone: 'success', text: 'Workspace aktif berhasil diganti.' });
    } finally {
      setWorkspaceSwitching(false);
    }
  };

  const openWorkspaceSettings = () => {
    router.push('/settings/workspace');
  };

  const runGenerateWeeklyReport = async () => {
    setMenuOpen(false);
    setBusy('report');
    setNotice(null);
    try {
      const res = await workspaceFetch('/api/admin/reports', { method: 'POST' });
      if (!res.ok) {
        const error = await parseApiErrorResponse(res, 'Gagal memproses trigger report mingguan.');
        if (recoverWorkspaceScopeViolation(error.code)) {
          return;
        }
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
      const res = await workspaceFetch('/api/admin/reports', { cache: 'no-store' });
      if (!res.ok) {
        const error = await parseApiErrorResponse(res, 'Gagal memuat daftar report mingguan.');
        if (recoverWorkspaceScopeViolation(error.code)) {
          return;
        }
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
    <header className="shrink-0 border-b border-zinc-800 bg-zinc-950 text-zinc-100 shadow-[0_1px_0_0_rgba(16,185,129,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-emerald-600 text-xs font-bold text-white shadow-[0_0_0_1px_rgba(16,185,129,0.35)]">
            P
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">Presence Studio</p>
            <p className="truncate text-xs text-zinc-400">{email}</p>
          </div>
        </div>

        <div className="hidden min-w-[220px] flex-1 lg:block">
          <div className="flex h-9 items-center rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-400">
            Search command palette
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <p className="text-sm font-medium text-zinc-100">{name}</p>
            <p className="text-xs uppercase tracking-wide text-zinc-400">{role}</p>
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-md bg-zinc-800 text-xs font-semibold text-zinc-200 md:hidden">
            {initials}
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      <div className="border-t border-zinc-800/80 px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-[260px] items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-400" htmlFor="workspace-switcher">
              Workspace
            </label>
            <select
              id="workspace-switcher"
              className="h-9 min-w-[200px] rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none focus:border-emerald-500/50"
              value={activeWorkspaceId ?? ''}
              onChange={(event) => void handleWorkspaceChange(event.target.value)}
              disabled={workspaceLoading || workspaceSwitching || memberships.length === 0}
            >
              {memberships.length === 0 ? (
                <option value="">{workspaceLoading ? 'Memuat workspace...' : 'Tidak ada workspace'}</option>
              ) : (
                memberships.map((item) => (
                  <option key={item.workspace._id} value={item.workspace._id}>
                    {item.workspace.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshDashboard()}
              disabled={busy !== 'none'}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 transition hover:border-emerald-500/40 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowsClockwise weight="regular" className={`h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
              <span>
                Updated{' '}
                {lastUpdatedAt.toLocaleDateString('id-ID', {
                  month: 'short',
                  day: '2-digit',
                  year: 'numeric',
                })}
              </span>
            </button>

            {role === 'superadmin' ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-md border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 hover:border-emerald-500/40 hover:bg-zinc-800"
                onClick={openWorkspaceSettings}
              >
                <SquaresFour weight="regular" className="mr-2 h-4 w-4" />
                Workspace
              </Button>
            ) : null}

            <div className="relative" ref={menuRef}>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-md border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 hover:border-emerald-500/40 hover:bg-zinc-800"
                onClick={() => setMenuOpen((prev) => !prev)}
                disabled={busy !== 'none'}
              >
                <DownloadSimple weight="regular" className="mr-2 h-4 w-4" />
                Report
                <CaretDown weight="regular" className="ml-2 h-4 w-4" />
              </Button>

              {menuOpen ? (
                <div className="absolute right-0 top-11 z-30 min-w-64 rounded-md border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
                  <button
                    type="button"
                    className="block w-full rounded px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
                    onClick={() => void runExportLatestReport()}
                  >
                    <span className="inline-flex items-center gap-2">
                      <FileArrowDown weight="regular" className="h-4 w-4" />
                      Export latest weekly report
                    </span>
                  </button>
                  <button
                    type="button"
                    className="mt-1 block w-full rounded px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
                    onClick={() => void runGenerateWeeklyReport()}
                  >
                    <span className="inline-flex items-center gap-2">
                      <ClockCounterClockwise weight="regular" className="h-4 w-4" />
                      Generate weekly report
                    </span>
                  </button>
                  <button
                    type="button"
                    className="mt-1 block w-full rounded px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
                    onClick={() => void refreshDashboard()}
                  >
                    <span className="inline-flex items-center gap-2">
                      <ArrowsClockwise weight="regular" className="h-4 w-4" />
                      Refresh dashboard data
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {notice ? (
          <div
            className={`mt-3 rounded-md border px-3 py-2 text-sm ${
              notice.tone === 'error'
                ? 'border-rose-300 bg-rose-50 text-rose-900'
                : notice.tone === 'success'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-sky-300 bg-sky-50 text-sky-900'
            }`}
          >
            {notice.text}
          </div>
        ) : null}
      </div>
    </header>
  );
}
