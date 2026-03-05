'use client';

import { UserButton, useUser } from '@clerk/nextjs';
import {
  CaretDown,
  MagnifyingGlass,
  SidebarSimple,
  ArrowsClockwise,
  DownloadSimple,
  FileArrowDown,
  ClockCounterClockwise,
} from '@phosphor-icons/react/dist/ssr';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { parseApiErrorResponse } from '@/lib/client-error';
import {
  recoverWorkspaceScopeViolation,
  setActiveWorkspaceIdInBrowser,
  workspaceFetch,
} from '@/lib/workspace-client';

type DashboardHeaderProps = {
  role?: string;
  name?: string;
  email?: string;
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

export function DashboardHeader({ name = 'Faiz Intifada', email = 'faiz@example.com', role = 'karyawan' }: DashboardHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user } = useUser();
  const actualName = user?.fullName || name;

  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(new Date());
  const [busy, setBusy] = useState<'none' | 'refresh' | 'report' | 'export'>('none');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceSwitching, setWorkspaceSwitching] = useState(false);
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  const initialSearchValue = useMemo(() => searchParams?.get('q') ?? '', [searchParams]);
  const [searchValue, setSearchValue] = useState(initialSearchValue);

  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => { document.removeEventListener('mousedown', handleOutsideClick); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadMemberships = async () => {
      setWorkspaceLoading(true);
      try {
        const res = await workspaceFetch('/api/workspaces/memberships', { cache: 'no-store' });
        if (!res.ok) return;
        const payload = (await res.json()) as WorkspaceMembershipsResponse;
        if (cancelled) return;
        setMemberships(payload.memberships);
        setActiveWorkspaceId(payload.activeWorkspaceId);
      } finally {
        if (!cancelled) setWorkspaceLoading(false);
      }
    };
    void loadMemberships();
    return () => { cancelled = true; };
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
        if (recoverWorkspaceScopeViolation(error.code)) return;
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
    if (!nextWorkspaceId || nextWorkspaceId === activeWorkspaceId) return;
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
        if (recoverWorkspaceScopeViolation(error.code)) return;
        setNotice({ tone: 'error', text: `[${error.code}] ${error.message}` });
        return;
      }
      setActiveWorkspaceId(nextWorkspaceId);
      setActiveWorkspaceIdInBrowser(nextWorkspaceId);
      window.dispatchEvent(new CustomEvent('workspace:changed', { detail: { workspaceId: nextWorkspaceId } }));
      setLastUpdatedAt(new Date());
      dispatchRefresh();
      router.refresh();
      setNotice({ tone: 'success', text: 'Workspace aktif berhasil diganti.' });
    } finally {
      setWorkspaceSwitching(false);
    }
  };

  const runGenerateWeeklyReport = async () => {
    setMenuOpen(false);
    setBusy('report');
    setNotice(null);
    try {
      const res = await workspaceFetch('/api/admin/reports', { method: 'POST' });
      if (!res.ok) {
        const error = await parseApiErrorResponse(res, 'Gagal memproses trigger report mingguan.');
        if (recoverWorkspaceScopeViolation(error.code)) return;
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
        if (recoverWorkspaceScopeViolation(error.code)) return;
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

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    const trimmed = searchValue.trim();
    if (trimmed.length > 0) {
      params.set('q', trimmed);
    } else {
      params.delete('q');
    }
    const query = params.toString();
    router.push(query.length > 0 ? `${pathname}?${query}` : pathname);
  };

  const activeWorkspaceInfo = memberships.find((m) => m.workspace._id === activeWorkspaceId);
  const workspaceDisplayText = activeWorkspaceInfo ? activeWorkspaceInfo.workspace.name : (workspaceLoading ? 'Memuat...' : 'Tidak ada workspace');

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 bg-[#141414] px-4 text-zinc-100 relative z-40">
        <div className="flex items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded bg-gradient-to-br from-indigo-500 to-purple-600 text-[10px] font-bold text-white shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 22V6C4 4.89543 4.89543 4 6 4H8C9.10457 4 10 4.89543 10 6V11L12 8L14 11V6C14 4.89543 14.89543 4 16 4H18C19.10457 4 20 4.89543 20 6V22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight">AI Studio</span>
            <CaretDown weight="bold" className="h-3 w-3 text-zinc-500" />
          </div>

          <button className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition">
            <SidebarSimple weight="regular" className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <div className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-800 transition">
              <div className="grid h-5 w-5 place-items-center rounded-full bg-zinc-700 text-[10px] font-medium text-white ring-1 ring-zinc-700">
                {actualName[0]?.toUpperCase()}
              </div>
              <span className="truncate max-w-[120px]">{actualName}</span>
            </div>

            <span className="text-zinc-600">/</span>

            <div className="relative group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-800 cursor-pointer transition">
              <div className="grid h-5 w-5 place-items-center rounded-sm bg-emerald-600/80 text-[10px] font-bold text-white shadow-sm ring-1 ring-emerald-500/50">
                {workspaceDisplayText[0]?.toUpperCase() || 'W'}
              </div>
              <span className="truncate max-w-[160px] font-medium">{workspaceDisplayText}</span>
              <CaretDown weight="bold" className="ml-1 h-3 w-3 text-zinc-500" />

              <select
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
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
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Actions */}
          <div className="flex items-center gap-1 border-r border-zinc-800 pr-3 mr-1">
            <button
              type="button"
              onClick={() => void refreshDashboard()}
              disabled={busy !== 'none'}
              title="Refresh Dashboard Data"
              className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition disabled:opacity-50"
            >
              <ArrowsClockwise weight="bold" className={`h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
            </button>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                disabled={busy !== 'none'}
                title="Reports Menu"
                className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition disabled:opacity-50"
              >
                <DownloadSimple weight="bold" className="h-4 w-4" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-10 z-50 min-w-56 rounded-md border border-zinc-700 bg-zinc-900 p-1 shadow-2xl">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                    onClick={() => void runExportLatestReport()}
                  >
                    <FileArrowDown weight="bold" className="h-3.5 w-3.5" />
                    Export latest weekly report
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                    onClick={() => void runGenerateWeeklyReport()}
                  >
                    <ClockCounterClockwise weight="bold" className="h-3.5 w-3.5" />
                    Generate weekly report
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <MagnifyingGlass weight="bold" className="absolute left-3 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search..."
              className="h-8 w-64 rounded-md border border-zinc-700 bg-zinc-800/50 pl-9 pr-14 text-sm text-zinc-200 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition"
            />
            <div className="absolute right-2 flex items-center gap-1">
              <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">Ctrl+K</kbd>
            </div>
          </form>

          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: { userButtonAvatarBox: "h-8 w-8 ring-1 ring-zinc-700 rounded-full" }
            }}
          />
        </div>
      </header>

      {notice && (
        <div className="absolute top-14 left-0 right-0 z-30 flex justify-center pt-2 pointer-events-none">
          <div className={`pointer-events-auto flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md transition-all animate-in slide-in-from-top-2 border ${notice.tone === 'error'
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              : notice.tone === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-sky-500/30 bg-sky-500/10 text-sky-200'
            }`}>
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)} className="ml-2 opacity-70 hover:opacity-100">
              &times;
            </button>
          </div>
        </div>
      )}
    </>
  );
}

