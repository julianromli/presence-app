'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { parseApiErrorResponse } from '@/lib/client-error';
import type { ApiErrorInfo } from '@/lib/client-error';
import { getLocalDateKey } from '@/lib/date-key';
import { recoverWorkspaceScopeViolation, workspaceFetch } from '@/lib/workspace-client';
import type { AdminUserRow } from '@/types/dashboard';

type PanelStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';
type NoticeTone = 'info' | 'success' | 'warning' | 'error';

type InlineNotice = {
  tone: NoticeTone;
  text: string;
};

type AttendanceRow = {
  _id: string;
  employeeName: string;
  dateKey: string;
  checkInAt?: number;
  checkOutAt?: number;
  edited: boolean;
};

type AttendanceSummary = {
  total: number;
  checkedIn: number;
  checkedOut: number;
  edited: number;
};

type AttendanceListResponse = {
  rows: AttendanceRow[];
  pageInfo: {
    continueCursor: string;
    isDone: boolean;
    splitCursor: string | null;
    pageStatus: 'SplitRecommended' | 'SplitRequired' | null;
  };
  summary: AttendanceSummary;
};

type AttendanceWorkspaceFilters = {
  dateKey: string;
  q: string;
  status: 'all' | 'not-checked-in' | 'checked-in' | 'incomplete' | 'completed';
  edited: 'all' | 'true' | 'false';
};

type EmployeeQuickListRow = Pick<AdminUserRow, '_id' | 'name' | 'email' | 'role' | 'isActive'>;

type AttendanceEditDraft = {
  attendanceId: string | null;
  checkInTime: string;
  checkOutTime: string;
  reason: string;
};

const DEFAULT_ATTENDANCE_FILTERS: AttendanceWorkspaceFilters = {
  dateKey: getLocalDateKey(),
  q: '',
  status: 'all',
  edited: 'all',
};

function noticeClass(tone: NoticeTone) {
  switch (tone) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'error':
      return 'border-rose-200 bg-rose-50/50 text-rose-900';
    default:
      return 'border-zinc-200 bg-zinc-50 text-zinc-900';
  }
}

function summaryCard(label: string, value: number) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-hover hover:shadow-md">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900">{value}</p>
    </div>
  );
}

function formatTime(value?: number) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function deriveAttendanceStatus(row: AttendanceRow) {
  if (row.checkInAt === undefined) return 'Belum check-in';
  if (row.checkOutAt === undefined) return 'Belum check-out';
  return 'Lengkap';
}

function matchesAttendanceStatus(filters: AttendanceWorkspaceFilters, row: AttendanceRow) {
  if (filters.status === 'all') return true;
  if (filters.status === 'not-checked-in') return row.checkInAt === undefined;
  if (filters.status === 'checked-in') return row.checkInAt !== undefined;
  if (filters.status === 'incomplete') {
    return row.checkInAt !== undefined && row.checkOutAt === undefined;
  }
  return row.checkInAt !== undefined && row.checkOutAt !== undefined;
}

function buildAttendanceQueryString(filters: AttendanceWorkspaceFilters, cursor: string | null) {
  const params = new URLSearchParams({
    dateKey: filters.dateKey,
    limit: '20',
  });

  if (cursor) {
    params.set('cursor', cursor);
  }

  const q = filters.q.trim();
  if (q.length > 0) {
    params.set('q', q);
  }

  if (filters.edited !== 'all') {
    params.set('edited', filters.edited);
  }

  return params.toString();
}

type UsersPanelProps = {
  viewerRole: 'admin' | 'superadmin';
  readOnly?: boolean;
};

export function UsersPanel({ viewerRole, readOnly = false }: UsersPanelProps) {
  const searchParams = useSearchParams();
  const headerQuery = (searchParams.get('q') ?? '').trim();
  const initialFilters = useMemo<AttendanceWorkspaceFilters>(
    () => ({
      ...DEFAULT_ATTENDANCE_FILTERS,
      q: headerQuery,
    }),
    [headerQuery],
  );

  /**
   * State buckets for the attendance-first workspace:
   * - attendance filters
   * - attendance rows + daily summary
   * - employee quick-list rows
   * - loading/error state per section
   * - edit draft state for inline light ops
   */
  const [filters, setFilters] = useState<AttendanceWorkspaceFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<AttendanceWorkspaceFilters>(initialFilters);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary>({
    total: 0,
    checkedIn: 0,
    checkedOut: 0,
    edited: 0,
  });
  const [employeeRows, setEmployeeRows] = useState<EmployeeQuickListRow[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<PanelStatus>('idle');
  const [employeeStatus, setEmployeeStatus] = useState<PanelStatus>('idle');
  const [attendanceError, setAttendanceError] = useState<ApiErrorInfo | null>(null);
  const [employeeError, setEmployeeError] = useState<ApiErrorInfo | null>(null);
  const [attendanceNotice, setAttendanceNotice] = useState<InlineNotice | null>(null);
  const [attendanceCursor, setAttendanceCursor] = useState<string | null>(null);
  const [attendanceIsLastPage, setAttendanceIsLastPage] = useState(true);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [isEmployeeLoading, setIsEmployeeLoading] = useState(false);
  const [editDraft, setEditDraft] = useState<AttendanceEditDraft>({
    attendanceId: null,
    checkInTime: '',
    checkOutTime: '',
    reason: 'Koreksi admin',
  });
  const hasLoadedInitial = useRef(false);
  const prevHeaderQueryRef = useRef(headerQuery);

  const filteredAttendanceRows = useMemo(
    () => attendanceRows.filter((row) => matchesAttendanceStatus(appliedFilters, row)),
    [appliedFilters, attendanceRows],
  );

  const hasAttendanceFilters = useMemo(
    () => appliedFilters.q.trim().length > 0 || appliedFilters.status !== 'all' || appliedFilters.edited !== 'all',
    [appliedFilters],
  );

  const loadAttendance = useCallback(
    async (
      options: {
        append?: boolean;
        cursor?: string | null;
        activeFilters?: AttendanceWorkspaceFilters;
      } = {},
    ) => {
      const append = options.append ?? false;
      const cursor = options.cursor ?? null;
      const activeFilters = options.activeFilters ?? appliedFilters;

      if (!append) {
        setAttendanceStatus('loading');
        setAttendanceError(null);
      }
      setIsAttendanceLoading(true);

      const response = await workspaceFetch(
        `/api/admin/attendance?${buildAttendanceQueryString(activeFilters, cursor)}`,
        {
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        const parsed = await parseApiErrorResponse(response, 'Gagal memuat attendance harian.');
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          setIsAttendanceLoading(false);
          return;
        }

        setAttendanceError(parsed);
        setAttendanceStatus('error');
        setIsAttendanceLoading(false);
        return;
      }

      const payload = (await response.json()) as AttendanceListResponse;
      const nextRows = append ? [...attendanceRows, ...payload.rows] : payload.rows;

      setAttendanceRows(nextRows);
      setAttendanceSummary(payload.summary);
      setAttendanceCursor(payload.pageInfo.isDone ? null : payload.pageInfo.continueCursor);
      setAttendanceIsLastPage(payload.pageInfo.isDone);
      setAttendanceStatus(nextRows.length === 0 ? 'empty' : 'success');
      setIsAttendanceLoading(false);
    },
    [appliedFilters, attendanceRows],
  );

  const loadEmployees = useCallback(
    async (activeFilters: AttendanceWorkspaceFilters = appliedFilters) => {
      setEmployeeStatus('loading');
      setEmployeeError(null);
      setIsEmployeeLoading(true);

      const params = new URLSearchParams({
        limit: '12',
        role: 'karyawan',
      });
      const q = activeFilters.q.trim();
      if (q.length > 0) {
        params.set('q', q);
      }

      const response = await workspaceFetch(`/api/admin/users?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const parsed = await parseApiErrorResponse(response, 'Gagal memuat daftar karyawan.');
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          setIsEmployeeLoading(false);
          return;
        }

        setEmployeeRows([]);
        setEmployeeError(parsed);
        setEmployeeStatus('error');
        setIsEmployeeLoading(false);
        return;
      }

      const payload = (await response.json()) as { rows: EmployeeQuickListRow[] };
      setEmployeeRows(payload.rows);
      setEmployeeStatus(payload.rows.length === 0 ? 'empty' : 'success');
      setIsEmployeeLoading(false);
    },
    [appliedFilters],
  );

  useEffect(() => {
    if (hasLoadedInitial.current) return;
    hasLoadedInitial.current = true;

    const frameId = requestAnimationFrame(() => {
      void loadAttendance({ activeFilters: initialFilters });
      void loadEmployees(initialFilters);
    });

    return () => cancelAnimationFrame(frameId);
  }, [initialFilters, loadAttendance, loadEmployees]);

  useEffect(() => {
    if (prevHeaderQueryRef.current === headerQuery) return;
    prevHeaderQueryRef.current = headerQuery;

    const nextFilters = {
      ...appliedFilters,
      q: headerQuery,
    };

    const frameId = requestAnimationFrame(() => {
      setFilters(nextFilters);
      setAppliedFilters(nextFilters);
      void loadAttendance({ activeFilters: nextFilters });
      void loadEmployees(nextFilters);
    });

    return () => cancelAnimationFrame(frameId);
  }, [appliedFilters, headerQuery, loadAttendance, loadEmployees]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadAttendance({ activeFilters: appliedFilters });
      void loadEmployees(appliedFilters);
    };

    window.addEventListener('dashboard:refresh', handleRefresh as EventListener);
    return () => {
      window.removeEventListener('dashboard:refresh', handleRefresh as EventListener);
    };
  }, [appliedFilters, loadAttendance, loadEmployees]);

  const handleFilterSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAppliedFilters(filters);
    await Promise.all([
      loadAttendance({ activeFilters: filters }),
      loadEmployees(filters),
    ]);
  };

  const notPresentCount = Math.max(attendanceSummary.total - attendanceSummary.checkedIn, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
        <p className="text-sm font-semibold tracking-tight text-zinc-900">Workspace absensi harian</p>
        <p className="mt-1 text-sm text-zinc-600">
          Fokuskan halaman ini pada review kehadiran harian, koreksi ringan, dan daftar cepat karyawan
          tanpa membuka permukaan report yang lebih luas.
        </p>
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
          Viewer role: <span className="font-semibold">{viewerRole}</span>.{' '}
          {readOnly
            ? 'Light edit disiapkan di state model, tetapi interaksi edit tetap dinonaktifkan pada tahap ini.'
            : 'Panel siap menerima light edit attendance pada iterasi berikutnya.'}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCard('Karyawan terpantau', attendanceSummary.total)}
        {summaryCard('Sudah check-in', attendanceSummary.checkedIn)}
        {summaryCard('Sudah check-out', attendanceSummary.checkedOut)}
        {summaryCard('Belum hadir', notPresentCount)}
        {summaryCard('Sudah diedit', attendanceSummary.edited)}
      </div>

      <section className="sticky top-3 z-10 rounded-xl border border-zinc-200 bg-white/95 p-5 shadow-sm backdrop-blur">
        <form onSubmit={handleFilterSubmit} className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)_180px_160px_auto]">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-zinc-700">Tanggal</span>
            <Input
              type="date"
              value={filters.dateKey}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  dateKey: event.target.value,
                }))
              }
              className="h-9"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-zinc-700">Cari karyawan</span>
            <Input
              value={filters.q}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  q: event.target.value,
                }))
              }
              placeholder="Nama karyawan"
              className="h-9"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-zinc-700">Status attendance</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as AttendanceWorkspaceFilters['status'],
                }))
              }
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
            >
              <option value="all">Semua</option>
              <option value="not-checked-in">Belum check-in</option>
              <option value="checked-in">Sudah check-in</option>
              <option value="incomplete">Belum check-out</option>
              <option value="completed">Lengkap</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-zinc-700">Status edit</span>
            <select
              value={filters.edited}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  edited: event.target.value as AttendanceWorkspaceFilters['edited'],
                }))
              }
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
            >
              <option value="all">Semua</option>
              <option value="true">Edited</option>
              <option value="false">Original</option>
            </select>
          </label>

          <div className="flex items-end gap-2">
            <Button type="submit" disabled={isAttendanceLoading || isEmployeeLoading}>
              {isAttendanceLoading || isEmployeeLoading ? 'Memuat...' : 'Terapkan'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const nextFilters = {
                  ...DEFAULT_ATTENDANCE_FILTERS,
                  q: headerQuery,
                };
                setFilters(nextFilters);
                setAppliedFilters(nextFilters);
                void loadAttendance({ activeFilters: nextFilters });
                void loadEmployees(nextFilters);
              }}
            >
              Reset
            </Button>
          </div>
        </form>

        {attendanceNotice ? (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${noticeClass(attendanceNotice.tone)}`}>
            {attendanceNotice.text}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2.2fr)_minmax(280px,0.9fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">Daftar attendance harian</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Tabel utama sekarang berorientasi ke review absensi, bukan manajemen akun.
              </p>
            </div>
            <span className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-semibold tracking-wide text-zinc-600">
              {filteredAttendanceRows.length} baris terlihat
            </span>
          </div>

          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Edited</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceStatus === 'loading' ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                    Memuat attendance...
                  </TableCell>
                </TableRow>
              ) : attendanceStatus === 'error' && attendanceError ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-rose-700">
                    [{attendanceError.code}] {attendanceError.message}
                  </TableCell>
                </TableRow>
              ) : filteredAttendanceRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                    {hasAttendanceFilters
                      ? 'Tidak ada attendance yang cocok dengan filter saat ini.'
                      : 'Belum ada attendance untuk tanggal yang dipilih.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAttendanceRows.map((row) => {
                  const isEditingTarget = editDraft.attendanceId === row._id;

                  return (
                    <TableRow key={row._id}>
                      <TableCell className="font-medium text-slate-900">{row.employeeName}</TableCell>
                      <TableCell>{deriveAttendanceStatus(row)}</TableCell>
                      <TableCell className="tabular-nums text-slate-600">{row.dateKey}</TableCell>
                      <TableCell className="tabular-nums text-slate-600">{formatTime(row.checkInAt)}</TableCell>
                      <TableCell className="tabular-nums text-slate-600">{formatTime(row.checkOutAt)}</TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            row.edited ? 'bg-amber-50 text-amber-700' : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          {row.edited ? 'Edited' : 'Original'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={readOnly}
                          onClick={() => {
                            setEditDraft({
                              attendanceId: row._id,
                              checkInTime: '',
                              checkOutTime: '',
                              reason: 'Koreksi admin',
                            });
                            setAttendanceNotice({
                              tone: 'info',
                              text: `Draft edit untuk ${row.employeeName} sudah disiapkan di state panel.`,
                            });
                          }}
                        >
                          {isEditingTarget ? 'Draft aktif' : 'Siapkan edit'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {!attendanceIsLastPage ? (
            <div className="border-t border-slate-100 p-3">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void loadAttendance({
                    append: true,
                    cursor: attendanceCursor,
                  })
                }
                disabled={isAttendanceLoading || !attendanceCursor}
              >
                {isAttendanceLoading ? 'Memuat...' : 'Muat lagi'}
              </Button>
            </div>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">Quick list karyawan</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Konteks sekunder untuk membantu review attendance harian, bukan tabel akun utama.
            </p>
          </div>

          <div className="space-y-3 p-4">
            {employeeStatus === 'loading' ? (
              <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500">
                Memuat quick list karyawan...
              </div>
            ) : employeeStatus === 'error' && employeeError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-4 text-sm text-rose-800">
                [{employeeError.code}] {employeeError.message}
              </div>
            ) : employeeRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500">
                Belum ada karyawan yang cocok dengan pencarian aktif.
              </div>
            ) : (
              employeeRows.map((employee) => {
                const isVisible = filteredAttendanceRows.some((row) => row.employeeName === employee.name);

                return (
                  <button
                    key={employee._id}
                    type="button"
                    className="flex w-full items-start justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                    onClick={() => {
                      setFilters((current) => ({
                        ...current,
                        q: employee.name,
                      }));
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{employee.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">{employee.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                          employee.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {employee.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <span className="text-[11px] text-zinc-500">{isVisible ? 'Ada di tabel' : 'Filter untuk lihat'}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
