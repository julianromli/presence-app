'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseApiErrorResponse } from '@/lib/client-error';
import type { ApiErrorInfo } from '@/lib/client-error';
import {
  buildUsersQueryString,
  DEFAULT_USERS_FILTERS,
  resolveUsersFilters,
  type UsersPanelFilters,
} from '@/lib/users-filters';
import { recoverWorkspaceScopeViolation, workspaceFetch } from '@/lib/workspace-client';
import type { AdminUsersPage, AdminUserRow } from '@/types/dashboard';

type PanelStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';
type NoticeTone = 'info' | 'success' | 'warning' | 'error';

type InlineNotice = {
  tone: NoticeTone;
  text: string;
};

function noticeClass(tone: NoticeTone) {
  switch (tone) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'error':
      return 'border-red-200 bg-red-50 text-red-900';
    default:
      return 'border-blue-200 bg-blue-50 text-blue-900';
  }
}

type UsersPanelProps = {
  viewerRole: 'admin' | 'superadmin';
  readOnly?: boolean;
};

export function UsersPanel({ viewerRole, readOnly = false }: UsersPanelProps) {
  const [filters, setFilters] = useState<UsersPanelFilters>(DEFAULT_USERS_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<UsersPanelFilters>(DEFAULT_USERS_FILTERS);
  const [status, setStatus] = useState<PanelStatus>('idle');
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [summary, setSummary] = useState<AdminUsersPage['summary']>({
    total: 0,
    active: 0,
    inactive: 0,
  });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLastPage, setIsLastPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [notice, setNotice] = useState<InlineNotice | null>(null);

  const hasFilters = useMemo(
    () =>
      appliedFilters.q.trim().length > 0 ||
      appliedFilters.role !== 'all' ||
      appliedFilters.isActive !== 'all',
    [appliedFilters],
  );

  const loadUsers = useCallback(
    async (
      opts: {
        append: boolean;
        cursor: string | null;
        activeFilters?: UsersPanelFilters;
      } = {
        append: false,
        cursor: null,
      },
    ) => {
      const activeFilters = resolveUsersFilters(DEFAULT_USERS_FILTERS, opts.activeFilters);

      if (!opts.append) {
        setStatus('loading');
        setError(null);
      }
      setLoading(true);

      const res = await workspaceFetch(`/api/admin/users?${buildUsersQueryString(activeFilters, opts.cursor)}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res, 'Gagal memuat data user.');
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          return;
        }
        setError(parsed);
        setStatus('error');
        setLoading(false);
        return;
      }

      const data = (await res.json()) as AdminUsersPage;
      let mergedCount = 0;

      setRows((prev) => {
        const nextRows = opts.append ? [...prev, ...data.rows] : data.rows;
        mergedCount = nextRows.length;
        return nextRows;
      });
      setSummary(data.summary);
      setNextCursor(data.pageInfo.isDone ? null : data.pageInfo.continueCursor);
      setIsLastPage(data.pageInfo.isDone);
      setStatus(mergedCount === 0 ? 'empty' : 'success');
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      void loadUsers({
        append: false,
        cursor: null,
        activeFilters: DEFAULT_USERS_FILTERS,
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [loadUsers]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadUsers({ append: false, cursor: null, activeFilters: appliedFilters });
    };

    window.addEventListener('dashboard:refresh', handleRefresh as EventListener);
    return () => {
      window.removeEventListener('dashboard:refresh', handleRefresh as EventListener);
    };
  }, [loadUsers, appliedFilters]);

  const handleFilterSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextFilters = resolveUsersFilters(filters);
    setAppliedFilters(nextFilters);
    await loadUsers({ append: false, cursor: null, activeFilters: nextFilters });
  };

  const updateUser = async (payload: { userId: string; role?: AdminUserRow['role']; isActive?: boolean }) => {
    const res = await workspaceFetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const parsed = await parseApiErrorResponse(res, 'Gagal mengubah data user.');
      if (recoverWorkspaceScopeViolation(parsed.code)) {
        return;
      }
      setNotice({ tone: 'error', text: `[${parsed.code}] ${parsed.message}` });
      return;
    }

    setNotice({ tone: 'success', text: 'Perubahan data user berhasil disimpan.' });
    await loadUsers({ append: false, cursor: null, activeFilters: appliedFilters });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-white to-zinc-100/70 p-4 shadow-sm md:p-5">
        <p className="text-sm font-semibold tracking-tight text-zinc-900">Kontrol akun operasional</p>
        <p className="mt-1 text-sm text-zinc-600">
          Kelola role, status aktif, dan pencarian akun operasional dalam satu tabel terpusat.
        </p>
        {readOnly ? (
          <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
            Halaman ini mode read-only. Manajemen role/status dipindahkan ke Settings &gt; Workspace.
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total User</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Aktif</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{summary.active}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Non-aktif</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{summary.inactive}</p>
        </div>
      </section>

      <section className="sticky top-3 z-10 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur md:p-5">
        <form onSubmit={handleFilterSubmit} className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto]">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Cari User</span>
            <Input
              value={filters.q}
              onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
              placeholder="Nama atau email"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Role</span>
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={filters.role}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  role: event.target.value as UsersPanelFilters['role'],
                }))
              }
            >
              <option value="all">Semua</option>
              <option value="superadmin">Superadmin</option>
              <option value="admin">Admin</option>
              <option value="karyawan">Karyawan</option>
              <option value="device-qr">Device QR</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={filters.isActive}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  isActive: event.target.value as UsersPanelFilters['isActive'],
                }))
              }
            >
              <option value="all">Semua</option>
              <option value="true">Aktif</option>
              <option value="false">Non-aktif</option>
            </select>
          </label>

          <div className="flex items-end gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Memuat...' : 'Terapkan'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const resetFilters = { ...DEFAULT_USERS_FILTERS };
                setFilters(resetFilters);
                setAppliedFilters(resetFilters);
                void loadUsers({ append: false, cursor: null, activeFilters: resetFilters });
              }}
            >
              Reset
            </Button>
          </div>
        </form>
        {notice ? (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${noticeClass(notice.tone)}`}>
            {notice.text}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-sm text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {status === 'loading' ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Memuat data user...
                  </td>
                </tr>
              ) : status === 'error' && error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-rose-700">
                    [{error.code}] {error.message}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    {hasFilters
                      ? 'Tidak ada user yang cocok dengan filter saat ini.'
                      : 'Belum ada data user.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const canToggleStatus =
                    viewerRole === 'superadmin' || (row.role !== 'admin' && row.role !== 'superadmin');
                  return (
                    <tr key={row._id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{row.name}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.email}</td>
                      <td className="px-4 py-3">
                        {viewerRole === 'superadmin' && !readOnly ? (
                          <select
                            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
                            value={row.role}
                            onChange={(event) =>
                              void updateUser({
                                userId: row._id,
                                role: event.target.value as AdminUserRow['role'],
                              })
                            }
                          >
                            <option value="superadmin">superadmin</option>
                            <option value="admin">admin</option>
                            <option value="karyawan">karyawan</option>
                            <option value="device-qr">device-qr</option>
                          </select>
                        ) : (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                            {row.role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            row.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {row.isActive ? 'Aktif' : 'Non-aktif'}
                        </span>
                      </td>
                    <td className="px-4 py-3 text-right">
                      {readOnly ? (
                        <span className="text-xs text-slate-500">Read-only</span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!canToggleStatus}
                          onClick={() =>
                            void updateUser({
                              userId: row._id,
                              isActive: !row.isActive,
                            })
                          }
                        >
                          {row.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>

        {!isLastPage ? (
          <div className="border-t border-slate-100 p-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void loadUsers({
                  append: true,
                  cursor: nextCursor,
                  activeFilters: appliedFilters,
                })
              }
              disabled={loading || !nextCursor}
            >
              {loading ? 'Memuat...' : 'Muat Lagi'}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
