"use client";

import type { AdminAttendanceRow, AdminUserRow } from "@/types/dashboard";
import {
  deriveAttendanceStatusMeta,
  findAttendanceRowForUser,
} from "@/lib/attendance-status";

type PanelStatus = "idle" | "loading" | "success" | "empty" | "error";

type EmployeeQuickListProps = {
  rows: Array<
    Pick<AdminUserRow, "_id" | "name" | "email" | "role" | "isActive">
  >;
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
  const activeCount = rows.filter((employee) => employee.isActive).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-4 border-b border-slate-100 px-5 py-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
            Daftar cepat karyawan
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Panel pendamping untuk mempercepat pencarian tanpa memindahkan fokus
            dari tabel utama.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
              Ditampilkan
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
              {rows.length}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
              Aktif
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
              {activeCount}
            </p>
          </div>
        </div>
      </div>

      <div className="p-3">
        {status === "loading" ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500">
            Memuat quick list karyawan...
          </div>
        ) : status === "error" ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-4 text-sm text-rose-800">
            {errorMessage}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-sm text-zinc-500">
            Tidak ada karyawan yang cocok dengan pencarian aktif. Ubah kata
            kunci atau reset filter untuk melihat daftar lagi.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
            {rows.map((employee, index) => {
              const attendance = findAttendanceRowForUser(
                attendanceRows,
                employee._id,
              );
              const attendanceIndicator = attendance
                ? deriveAttendanceStatusMeta(attendance).label
                : "Belum muncul di tabel";

              return (
                <button
                  key={employee._id}
                  type="button"
                  className={`flex w-full items-start justify-between px-4 py-3 text-left transition-colors hover:bg-zinc-50 ${
                    index !== rows.length - 1 ? "border-b border-zinc-100" : ""
                  }`}
                  onClick={() => onSelectEmployee(employee.name)}
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {employee.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {employee.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        employee.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {employee.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {attendanceIndicator}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
