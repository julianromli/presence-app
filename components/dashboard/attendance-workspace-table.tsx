"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createAttendanceEditDraft,
  createEmptyAttendanceEditDraft,
  type AttendanceEditDraft,
} from "@/lib/attendance-edit";
import { deriveAttendanceStatusMeta } from "@/lib/attendance-status";
import type { AdminAttendanceRow } from "@/types/dashboard";

type PanelStatus = "idle" | "loading" | "success" | "empty" | "error";

type AttendanceWorkspaceTableProps = {
  rows: AdminAttendanceRow[];
  status: PanelStatus;
  errorMessage?: string | null;
  hasFilters: boolean;
  isLoading: boolean;
  hasNextPage: boolean;
  readOnly: boolean;
  activeDraft: AttendanceEditDraft;
  rowActionAttendanceId: string | null;
  onStartEdit: (row: AdminAttendanceRow) => void;
  onDraftChange: (draft: AttendanceEditDraft) => void;
  onCancelEdit: () => void;
  onConfirmSave: (row: AdminAttendanceRow) => void;
  onLoadMore: () => void;
};

function formatTime(value?: number) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AttendanceWorkspaceTable({
  rows,
  status,
  errorMessage,
  hasFilters,
  isLoading,
  hasNextPage,
  readOnly,
  activeDraft,
  rowActionAttendanceId,
  onStartEdit,
  onDraftChange,
  onCancelEdit,
  onConfirmSave,
  onLoadMore,
}: AttendanceWorkspaceTableProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
            Daftar review absensi
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Fokus utama halaman ini. Temukan pengecualian, lalu koreksi langsung
            pada baris yang relevan.
          </p>
        </div>
        <span className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-semibold tracking-wide text-zinc-600">
          {rows.length} baris terlihat
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-100 bg-zinc-50/50 px-6 py-3 text-xs text-zinc-600">
        <span className="font-medium text-zinc-900">Prioritas review:</span>
        <span>1. Belum check-in</span>
        <span>2. Belum check-out</span>
        <span>3. Koreksi yang perlu audit</span>
      </div>

      <Table className="min-w-[960px]">
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead>Check-in</TableHead>
            <TableHead>Check-out</TableHead>
            <TableHead>Status edit</TableHead>
            <TableHead className="w-[320px] text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {status === "loading" ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-24 text-center text-slate-500"
              >
                Memuat attendance...
              </TableCell>
            </TableRow>
          ) : status === "error" ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-rose-700">
                {errorMessage}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="px-6 py-10 text-center">
                <div className="mx-auto max-w-md space-y-2">
                  <p className="text-sm font-medium text-zinc-900">
                    {hasFilters
                      ? "Tidak ada data yang cocok dengan filter saat ini."
                      : "Belum ada absensi pada tanggal ini."}
                  </p>
                  <p className="text-sm leading-6 text-zinc-500">
                    {hasFilters
                      ? "Coba longgarkan pencarian atau reset filter agar daftar utama terisi kembali."
                      : "Pilih tanggal lain atau refresh data jika absensi hari ini seharusnya sudah masuk."}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const statusMeta = deriveAttendanceStatusMeta(row);
              const isEditing = activeDraft.attendanceId === row._id;
              const isActing = rowActionAttendanceId === row._id;

              return (
                <TableRow
                  key={row._id}
                  className={isEditing ? "bg-zinc-50/70 align-top" : undefined}
                >
                  <TableCell className="font-medium text-slate-900">
                    {row.employeeName}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        statusMeta.tone === "success"
                          ? "bg-emerald-50 text-emerald-700"
                          : statusMeta.tone === "warning"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {statusMeta.label}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums text-slate-600">
                    {row.dateKey}
                  </TableCell>
                  <TableCell className="tabular-nums text-slate-600">
                    {isEditing ? (
                      <Input
                        value={activeDraft.checkInTime}
                        onChange={(event) =>
                          onDraftChange({
                            ...activeDraft,
                            checkInTime: event.target.value,
                          })
                        }
                        placeholder="08:00"
                        className="h-8"
                      />
                    ) : (
                      formatTime(row.checkInAt)
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-slate-600">
                    {isEditing ? (
                      <Input
                        value={activeDraft.checkOutTime}
                        onChange={(event) =>
                          onDraftChange({
                            ...activeDraft,
                            checkOutTime: event.target.value,
                          })
                        }
                        placeholder="17:00"
                        className="h-8"
                      />
                    ) : (
                      formatTime(row.checkOutAt)
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        row.edited
                          ? "bg-amber-50 text-amber-700"
                          : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {row.edited ? "Dikoreksi" : "Asli"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={activeDraft.reason}
                          onChange={(event) =>
                            onDraftChange({
                              ...activeDraft,
                              reason: event.target.value,
                            })
                          }
                          placeholder="Tuliskan alasan koreksi"
                          className="min-h-[72px] text-sm"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onDraftChange(createEmptyAttendanceEditDraft());
                              onCancelEdit();
                            }}
                            disabled={isActing}
                          >
                            Batal
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => onConfirmSave(row)}
                            disabled={isActing || readOnly}
                            isLoading={isActing}
                            loadingText="Menyimpan..."
                          >
                            Simpan
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={readOnly}
                        onClick={() => {
                          onDraftChange(createAttendanceEditDraft(row));
                          onStartEdit(row);
                        }}
                      >
                        Koreksi
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {hasNextPage ? (
        <div className="border-t border-slate-100 bg-zinc-50/40 p-3">
          <Button
            type="button"
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoading}
            isLoading={isLoading}
          >
            Muat lagi
          </Button>
        </div>
      ) : null}
    </section>
  );
}
