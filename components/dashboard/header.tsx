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
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu';
import { useSidebar } from '@/components/providers/sidebar-provider';
import { parseApiErrorResponse } from '@/lib/client-error';
import {
  recoverWorkspaceScopeViolation,
  workspaceFetch,
} from '@/lib/workspace-client';
import { WorkspaceHubDialog } from '@/components/dashboard/workspace-hub-dialog';
import { useWorkspaceHub } from '@/components/dashboard/workspace-hub-provider';

type DashboardHeaderProps = {
  role?: string;
  name?: string;
  email?: string;
};

type WeeklyReportRow = {
  _id: string;
  status: 'pending' | 'success' | 'failed';
};

type SearchCapability = {
  enabled: boolean;
  scopeLabel: string;
};

function resolveSearchCapability(pathname: string): SearchCapability {
  if (pathname.startsWith('/dashboard/attendance')) {
    return {
      enabled: true,
      scopeLabel: 'Cari tanggal absensi personal',
    };
  }
  if (pathname.startsWith('/dashboard/leaderboard')) {
    return {
      enabled: true,
      scopeLabel: 'Cari posisi leaderboard',
    };
  }
  if (pathname.startsWith('/settings/geofence')) {
    return {
      enabled: false,
      scopeLabel: 'Search tidak tersedia di halaman ini',
    };
  }
  if (pathname.startsWith('/dashboard/users')) {
    return {
      enabled: true,
      scopeLabel: 'Cari user (nama atau email)',
    };
  }
  if (pathname.startsWith('/dashboard/report')) {
    return {
      enabled: true,
      scopeLabel: 'Cari attendance karyawan',
    };
  }
  if (pathname.startsWith('/settings/workspace')) {
    return {
      enabled: true,
      scopeLabel: 'Cari member workspace',
    };
  }
  return {
    enabled: true,
    scopeLabel: 'Cari aktivitas dashboard',
  };
}

function overviewEndpointForRole(role: string) {
  return role === 'karyawan'
    ? '/api/karyawan/dashboard/overview'
    : '/api/admin/dashboard/overview';
}

export function DashboardHeader({ name = 'Faiz Intifada', email = 'faiz@example.com', role = 'karyawan' }: DashboardHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user } = useUser();
  const { toggleSidebar, isCollapsed } = useSidebar();
  const {
    memberships,
    activeWorkspaceId,
    activeWorkspaceName,
    loading: workspaceLoading,
    notice: workspaceNotice,
    clearNotice: clearWorkspaceNotice,
    pendingAction,
    switchWorkspace,
    createWorkspace,
    joinWorkspace,
  } = useWorkspaceHub();
  const actualName = user?.fullName || name;
  const actualEmail = user?.primaryEmailAddress?.emailAddress || email;

  const [busy, setBusy] = useState<'none' | 'refresh' | 'report' | 'export'>('none');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [workspaceDialogMode, setWorkspaceDialogMode] = useState<'create' | 'join' | null>(null);

  const initialSearchValue = useMemo(() => searchParams?.get('q') ?? '', [searchParams]);
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const searchCapability = useMemo(() => resolveSearchCapability(pathname), [pathname]);
  const canManageReports = role === 'admin' || role === 'superadmin';
  const workspaceSwitching = pendingAction === 'switch';

  const menuRef = useRef<HTMLDivElement | null>(null);
  const desktopSearchRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchRef = useRef<HTMLInputElement | null>(null);

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
    setSearchValue(initialSearchValue);
  }, [initialSearchValue]);

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (!isShortcut) return;
      event.preventDefault();
      if (!searchCapability.enabled) return;

      if (window.innerWidth < 768) {
        setMobileSearchOpen(true);
        requestAnimationFrame(() => mobileSearchRef.current?.focus());
        return;
      }

      desktopSearchRef.current?.focus();
    };

    window.addEventListener('keydown', handleSearchShortcut);
    return () => {
      window.removeEventListener('keydown', handleSearchShortcut);
    };
  }, [searchCapability.enabled]);

  const dispatchRefresh = () => {
    window.dispatchEvent(new CustomEvent('dashboard:refresh'));
  };

  const refreshDashboard = async () => {
    setBusy('refresh');
    setNotice(null);
    try {
      const res = await workspaceFetch(overviewEndpointForRole(role), { cache: 'no-store' });
      if (!res.ok) {
        const error = await parseApiErrorResponse(res, 'Gagal menyegarkan data dashboard.');
        if (recoverWorkspaceScopeViolation(error.code)) return;
        setNotice({ tone: 'error', text: `[${error.code}] ${error.message}` });
        return;
      }
      dispatchRefresh();
      setNotice({ tone: 'success', text: 'Dashboard berhasil diperbarui.' });
    } finally {
      setBusy('none');
    }
  };

  const handleWorkspaceChange = async (nextWorkspaceId: string) => {
    const succeeded = await switchWorkspace(nextWorkspaceId);
    if (succeeded) {
      setWorkspaceMenuOpen(false);
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const handleWorkspaceDialogSubmit = async (value: string) => {
    const succeeded =
      workspaceDialogMode === 'join'
        ? await joinWorkspace(value)
        : await createWorkspace(value);

    if (succeeded) {
      setWorkspaceMenuOpen(false);
      startTransition(() => {
        router.refresh();
      });
    }

    return succeeded;
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
    if (!searchCapability.enabled) return;
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

  const workspaceDisplayText = activeWorkspaceName;
  const visibleNotice = workspaceNotice ?? notice;

  return (
    <>
      <WorkspaceHubDialog
        mode={workspaceDialogMode}
        open={workspaceDialogMode !== null}
        pendingAction={pendingAction}
        onOpenChange={(open) => {
          if (!open) {
            setWorkspaceDialogMode(null);
          }
        }}
        onSubmit={handleWorkspaceDialogSubmit}
      />
      <header className="relative z-40 shrink-0 border-b border-zinc-800 bg-[#141414] px-3 py-2 text-zinc-100 md:px-4">
        <div className="flex min-w-0 items-center justify-between gap-2">
          {/* Brand */}
          <div className="flex min-w-0 items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              <Image
                src="/favicon/favicon.ico"
                alt="Absenin.id"
                width={28}
                height={28}
                className="h-7 w-7 rounded"
                priority
              />
              <span className="hidden text-sm font-semibold tracking-tight sm:inline">Absenin.id</span>
            </div>

            <button
              onClick={toggleSidebar}
              title={isCollapsed ? "Expand Sidebar" : "Minimize Sidebar"}
              className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              <SidebarSimple weight="regular" className="h-5 w-5" />
            </button>

            <div className="hidden items-center gap-2 text-sm text-zinc-300 md:flex">
              <div className="flex items-center gap-2 rounded px-2 py-1.5 transition hover:bg-zinc-800" title={actualEmail}>
                <div className="grid h-5 w-5 place-items-center rounded-full bg-zinc-700 text-[10px] font-medium text-white ring-1 ring-zinc-700">
                  {actualName[0]?.toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate">{actualName}</span>
              </div>

              <span className="text-zinc-600">/</span>

              <Menu open={workspaceMenuOpen} onOpenChange={setWorkspaceMenuOpen}>
                <MenuTrigger
                  className="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={workspaceLoading || workspaceSwitching}
                >
                  <div className="grid h-5 w-5 place-items-center rounded-sm bg-emerald-600/80 text-[10px] font-bold text-white shadow-sm ring-1 ring-emerald-500/50">
                    {workspaceDisplayText[0]?.toUpperCase() || 'W'}
                  </div>
                  <span className="max-w-[160px] truncate font-medium">{workspaceDisplayText}</span>
                  <CaretDown weight="bold" className="ml-1 h-3 w-3 text-zinc-500" />
                </MenuTrigger>
                <MenuPopup
                  align="start"
                  className="min-w-[240px] border-zinc-700 bg-zinc-900 text-zinc-100"
                >
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    Workspace
                  </div>
                  <MenuRadioGroup
                    value={activeWorkspaceId ?? ''}
                    onValueChange={(value) => void handleWorkspaceChange(value)}
                  >
                    {memberships.map((item) => (
                      <MenuRadioItem
                        key={item.workspace._id}
                        value={item.workspace._id}
                        className="data-highlighted:bg-zinc-800"
                      >
                        {item.workspace.name}
                      </MenuRadioItem>
                    ))}
                  </MenuRadioGroup>
                  <MenuSeparator className="my-1 h-px bg-zinc-800" />
                  <MenuItem
                    className="text-zinc-100 data-highlighted:bg-zinc-800 data-highlighted:text-zinc-100"
                    onClick={() => setWorkspaceDialogMode('create')}
                  >
                    Buat workspace baru
                  </MenuItem>
                  <MenuItem
                    className="text-zinc-100 data-highlighted:bg-zinc-800 data-highlighted:text-zinc-100"
                    onClick={() => setWorkspaceDialogMode('join')}
                  >
                    Gabung workspace
                  </MenuItem>
                </MenuPopup>
              </Menu>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-1 border-r border-zinc-800 pr-2 sm:pr-3">
              <button
                type="button"
                onClick={() => setMobileSearchOpen((prev) => !prev)}
                title="Toggle Search"
                className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 md:hidden"
              >
                <MagnifyingGlass weight="bold" className="h-4 w-4" />
              </button>
              <form onSubmit={handleSearchSubmit} className="relative hidden items-center md:flex">
                <MagnifyingGlass weight="bold" className="absolute left-3 h-4 w-4 text-zinc-400" />
                <input
                  ref={desktopSearchRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={searchCapability.scopeLabel}
                  disabled={!searchCapability.enabled}
                  className="h-8 w-56 rounded-md border border-zinc-700 bg-zinc-800/50 pl-9 pr-14 text-sm text-zinc-200 transition placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 lg:w-64"
                />
                <div className="absolute right-2 flex items-center gap-1">
                  <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">Ctrl+K</kbd>
                </div>
              </form>
            </div>

            <Button
              type="button"
              onClick={() => void refreshDashboard()}
              disabled={busy !== 'none'}
              title="Refresh Dashboard Data"
              variant="ghost"
              size="icon-sm"
              aria-label="Refresh Dashboard Data"
              className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              isLoading={busy === 'refresh'}
            >
              {busy !== 'refresh' ? <ArrowsClockwise weight="bold" className="h-4 w-4" /> : null}
            </Button>
            {canManageReports ? (
              <div className="relative" ref={menuRef}>
                <Button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  disabled={busy !== 'none'}
                  title="Reports Menu"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Reports Menu"
                  className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  isLoading={busy === 'report' || busy === 'export'}
                >
                  {busy !== 'report' && busy !== 'export' ? (
                    <DownloadSimple weight="bold" className="h-4 w-4" />
                  ) : null}
                </Button>
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
            ) : null}

            <div className="hidden md:block">
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: { userButtonAvatarBox: "h-8 w-8 ring-1 ring-zinc-700 rounded-full" }
                }}
              />
            </div>
          </div>
        </div>

        {mobileSearchOpen ? (
          <form onSubmit={handleSearchSubmit} className="mt-2 flex items-center gap-2 md:hidden">
            <div className="relative flex-1">
              <MagnifyingGlass weight="bold" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                ref={mobileSearchRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={searchCapability.scopeLabel}
                disabled={!searchCapability.enabled}
                className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-800/60 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-500 transition focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              className="rounded-md border border-zinc-700 px-2.5 py-2 text-xs font-medium text-zinc-300"
            >
              Tutup
            </button>
          </form>
        ) : null}
      </header>

      {visibleNotice && (
        <div className="absolute top-14 left-0 right-0 z-30 flex justify-center pt-2 pointer-events-none">
          <div className={`pointer-events-auto flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md transition-all animate-in slide-in-from-top-2 border ${visibleNotice.tone === 'error'
            ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
            : visibleNotice.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-sky-500/30 bg-sky-500/10 text-sky-200'
            }`}>
            <span>{visibleNotice.text}</span>
            <button
              onClick={() => {
                if (workspaceNotice) {
                  clearWorkspaceNotice();
                  return;
                }
                setNotice(null);
              }}
              className="ml-2 opacity-70 hover:opacity-100"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </>
  );
}

