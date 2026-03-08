'use client';

import type { AdminAttendanceRow, AdminUserRow } from '@/types/dashboard';
import { deriveAttendanceStatusMeta, findAttendanceRowForUser } from '@/lib/attendance-status';

type PanelStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

type EmployeeQuickListProps = {
  rows: Array<Pick<AdminUserRow, '_id' | 'name' | 'email' | 'role' | 'isActive'>>;
  status: PanelStatus;
  errorMessage?: string | null;
  attendanceRows: AdminAttendanceRow[];
  onSelectEmployee: (employeeName: string) => void;
};

export function EmployeeQuickList({
  rows,
  status,
  errorMessage,
  attendanceRows,
  onSelectEmployee,
}: EmployeeQuickListProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">Quick list karyawan</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Konteks sekunder untuk membantu review attendance harian tanpa mengambil alih tabel utama.
        </p>
      </div>

      <div className="space-y-3 p-4">
        {status === 'loading' ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500">
            Memuat quick list karyawan...
          </div>
        ) : status === 'error' ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-4 text-sm text-rose-800">
            {errorMessage}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500">
            Belum ada karyawan yang cocok dengan pencarian aktif.
          </div>
        ) : (
          rows.map((employee) => {
            const attendance = findAttendanceRowForUser(attendanceRows, employee._id);
            const attendanceIndicator = attendance
              ? deriveAttendanceStatusMeta(attendance).label
              : 'Filter untuk lihat';

            return (
              <button
                key={employee._id}
                type="button"
                className="flex w-full items-start justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                onClick={() => onSelectEmployee(employee.name)}
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
                  <span className="text-[11px] text-zinc-500">{attendanceIndicator}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
