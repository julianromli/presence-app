"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { parseApiErrorResponse } from "@/lib/client-error";
import type { ApiErrorInfo } from "@/lib/client-error";
import { getLocalDateKey } from "@/lib/date-key";
import { cn } from "@/lib/utils";

type AttendanceRow = {
  _id: string;
  employeeName: string;
  dateKey: string;
  checkInAt?: number;
  checkOutAt?: number;
  edited: boolean;
};

type WeeklyReportRow = {
  _id: string;
  weekKey: string;
  startDate: string;
  endDate: string;
  status: "pending" | "success" | "failed";
  generatedAt?: number;
  fileName?: string;
  errorMessage?: string;
  triggerSource?: "manual" | "cron";
  attempts?: number;
  durationMs?: number;
  startedAt?: number;
  finishedAt?: number;
};

type WeeklyTriggerResponse = {
  weekKey: string;
  status: "pending" | "success" | "failed";
  skipped: boolean;
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
    pageStatus: "SplitRecommended" | "SplitRequired" | null;
  };
  summary: AttendanceSummary;
};

type LoadAttendanceOptions = {
  append: boolean;
  cursor: string | null;
};

type LoadReportOptions = {
  silent?: boolean;
};

type ScanEventRow = {
  _id: string;
  actorName: string;
  actorEmail: string;
  dateKey: string;
  resultStatus: "accepted" | "rejected";
  reasonCode: string;
  attendanceStatus?: "check-in" | "check-out";
  message?: string;
  scannedAt: number;
};

type ScanEventSummary = {
  total: number;
  accepted: number;
  rejected: number;
  byReason: Array<{ reasonCode: string; count: number }>;
};

type ScanEventsResponse = {
  rows: ScanEventRow[];
  summary: ScanEventSummary;
};

type DeviceHeartbeatRow = {
  deviceUserId: string;
  name: string;
  email: string;
  role: "device-qr";
  isActive: boolean;
  lastSeenAt?: number;
  online: boolean;
};

type PanelStatus = "idle" | "loading" | "success" | "empty" | "error";
type NoticeTone = "info" | "success" | "warning" | "error";

type InlineNotice = {
  tone: NoticeTone;
  text: string;
};

type AttendanceEditDraft = {
  checkInTime: string;
  checkOutTime: string;
  reason: string;
};

type SectionKey = "attendance" | "scanEvents" | "device" | "weekly";

function noticeClass(tone: NoticeTone) {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "error":
      return "border-red-200 bg-red-50 text-red-900";
    default:
      return "border-blue-200 bg-blue-50 text-blue-900";
  }
}

function summaryCard(
  label: string,
  value: number,
  tone: "default" | "success" | "danger" = "default",
) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 border-emerald-200"
      : tone === "danger"
        ? "bg-rose-50 border-rose-200"
        : "bg-white border-slate-200";

  return (
    <div className={cn("rounded-xl border p-4", toneClass)}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function sectionTitle(title: string, description: string, countLabel?: string) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      {countLabel ? (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
          {countLabel}
        </span>
      ) : null}
    </div>
  );
}

export function ReportPanel() {
  const [dateKey, setDateKey] = useState(() => getLocalDateKey());
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({
    total: 0,
    checkedIn: 0,
    checkedOut: 0,
    edited: 0,
  });
  const [employeeName, setEmployeeName] = useState("");
  const [editedFilter, setEditedFilter] = useState<"all" | "true" | "false">(
    "all",
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLastPage, setIsLastPage] = useState(true);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<PanelStatus>("idle");
  const [attendanceError, setAttendanceError] = useState<ApiErrorInfo | null>(
    null,
  );
  const [reportsStatus, setReportsStatus] = useState<PanelStatus>("idle");
  const [reportsError, setReportsError] = useState<ApiErrorInfo | null>(null);
  const [notice, setNotice] = useState<InlineNotice | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [confirmSaveRowId, setConfirmSaveRowId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<AttendanceEditDraft>({
    checkInTime: "",
    checkOutTime: "",
    reason: "Koreksi admin",
  });
  const [rowActionLoading, setRowActionLoading] = useState(false);
  const [reports, setReports] = useState<WeeklyReportRow[]>([]);
  const [scanEvents, setScanEvents] = useState<ScanEventRow[]>([]);
  const [scanEventSummary, setScanEventSummary] = useState<ScanEventSummary>({
    total: 0,
    accepted: 0,
    rejected: 0,
    byReason: [],
  });
  const [scanEventsStatus, setScanEventsStatus] = useState<PanelStatus>("idle");
  const [deviceRows, setDeviceRows] = useState<DeviceHeartbeatRow[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<PanelStatus>("idle");
  const [sectionOpen, setSectionOpen] = useState<Record<SectionKey, boolean>>({
    attendance: true,
    scanEvents: true,
    device: false,
    weekly: false,
  });

  const hasAttendanceFilter =
    employeeName.trim().length > 0 || editedFilter !== "all";

  const toggleSection = (key: SectionKey, open: boolean) => {
    setSectionOpen((prev) => ({ ...prev, [key]: open }));
  };

  const buildAttendanceParams = useCallback(
    (cursor: string | null) => {
      const params = new URLSearchParams({
        dateKey,
        limit: "25",
      });

      if (cursor) {
        params.set("cursor", cursor);
      }

      const query = employeeName.trim();
      if (query.length > 0) {
        params.set("q", query);
      }

      if (editedFilter !== "all") {
        params.set("edited", editedFilter);
      }

      return params.toString();
    },
    [dateKey, editedFilter, employeeName],
  );

  const loadAttendance = useCallback(
    async (opts: LoadAttendanceOptions = { append: false, cursor: null }) => {
      if (!opts.append) {
        setAttendanceStatus("loading");
        setAttendanceError(null);
      }
      setIsLoadingAttendance(true);

      try {
        const res = await fetch(
          `/api/admin/attendance?${buildAttendanceParams(opts.cursor)}`,
          {
            cache: "no-store",
          },
        );

        if (!res.ok) {
          const error = await parseApiErrorResponse(
            res,
            "Gagal memuat data attendance.",
          );
          setAttendanceError(error);
          setAttendanceStatus("error");
          setNotice({
            tone: "error",
            text: `[${error.code}] ${error.message}`,
          });
          return;
        }

        const data = (await res.json()) as AttendanceListResponse;
        let mergedCount = 0;

        setRows((prev) => {
          const nextRows = opts.append ? [...prev, ...data.rows] : data.rows;
          mergedCount = nextRows.length;
          return nextRows;
        });
        setSummary(data.summary);
        setNextCursor(
          data.pageInfo.isDone ? null : data.pageInfo.continueCursor,
        );
        setIsLastPage(data.pageInfo.isDone);
        setAttendanceStatus(mergedCount === 0 ? "empty" : "success");
        setAttendanceError(null);
      } finally {
        setIsLoadingAttendance(false);
      }
    },
    [buildAttendanceParams],
  );

  const loadMoreAttendance = async () => {
    if (!nextCursor || isLastPage || isLoadingAttendance) {
      return;
    }
    await loadAttendance({ append: true, cursor: nextCursor });
  };

  const loadReports = useCallback(async (opts: LoadReportOptions = {}) => {
    if (!opts.silent) {
      setReportsStatus("loading");
      setReportsError(null);
    }

    const res = await fetch("/api/admin/reports", { cache: "no-store" });
    if (!res.ok) {
      const error = await parseApiErrorResponse(
        res,
        "Gagal memuat daftar report mingguan.",
      );
      setReportsStatus("error");
      setReportsError(error);
      if (!opts.silent) {
        setNotice({ tone: "error", text: `[${error.code}] ${error.message}` });
      }
      return;
    }

    const data = (await res.json()) as WeeklyReportRow[];
    setReports(data);
    setReportsStatus(data.length === 0 ? "empty" : "success");
    setReportsError(null);
  }, []);

  const loadScanEvents = useCallback(async () => {
    setScanEventsStatus("loading");
    const res = await fetch(
      `/api/admin/attendance/scan-events?dateKey=${encodeURIComponent(dateKey)}&limit=50`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      setScanEventsStatus("error");
      return;
    }

    const data = (await res.json()) as ScanEventsResponse;
    setScanEvents(data.rows);
    setScanEventSummary(data.summary);
    setScanEventsStatus(data.rows.length === 0 ? "empty" : "success");
  }, [dateKey]);

  const loadDeviceHeartbeat = useCallback(async () => {
    setDeviceStatus("loading");
    const res = await fetch("/api/admin/device/heartbeat", {
      cache: "no-store",
    });
    if (!res.ok) {
      setDeviceStatus("error");
      return;
    }

    const data = (await res.json()) as DeviceHeartbeatRow[];
    setDeviceRows(data);
    setDeviceStatus(data.length === 0 ? "empty" : "success");
  }, []);

  const triggerWeeklyReport = async () => {
    setNotice({ tone: "info", text: "Memproses report mingguan..." });
    const res = await fetch("/api/admin/reports", { method: "POST" });
    if (!res.ok) {
      const error = await parseApiErrorResponse(
        res,
        "Gagal memproses trigger report mingguan.",
      );
      setNotice({ tone: "error", text: `[${error.code}] ${error.message}` });
      return;
    }

    const data = (await res.json()) as WeeklyTriggerResponse;
    if (data.skipped) {
      setNotice({
        tone: "warning",
        text: `Report ${data.weekKey ?? "-"} dilewati karena status existing: ${data.status ?? "unknown"}.`,
      });
    } else {
      setNotice({
        tone: "success",
        text: `Report ${data.weekKey ?? "-"} status: ${data.status ?? "unknown"}.`,
      });
    }
    await loadReports();
  };

  const downloadReport = (reportId: string) => {
    window.location.assign(
      `/api/admin/reports/download?reportId=${encodeURIComponent(reportId)}`,
    );
  };

  const formatTimeInput = (value?: number) => {
    if (value === undefined) return "";
    const date = new Date(value);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const buildTimestampFromDateKeyAndTime = (baseDateKey: string, hhmm: string) => {
    if (!hhmm) return undefined;
    const [hoursRaw, minutesRaw] = hhmm.split(":");
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
      return undefined;
    }

    const date = new Date(`${baseDateKey}T00:00:00`);
    date.setHours(hours, minutes, 0, 0);
    return date.getTime();
  };

  const startEditRow = (row: AttendanceRow) => {
    setEditingRowId(row._id);
    setConfirmSaveRowId(null);
    setEditDraft({
      checkInTime: formatTimeInput(row.checkInAt),
      checkOutTime: formatTimeInput(row.checkOutAt),
      reason: "Koreksi admin",
    });
  };

  const cancelEditRow = () => {
    setEditingRowId(null);
    setConfirmSaveRowId(null);
    setEditDraft({
      checkInTime: "",
      checkOutTime: "",
      reason: "Koreksi admin",
    });
  };

  const saveEditRow = async (row: AttendanceRow) => {
    if (!editDraft.reason.trim()) {
      setNotice({
        tone: "warning",
        text: "[VALIDATION_ERROR] Alasan edit wajib diisi.",
      });
      return;
    }

    const checkInAt = buildTimestampFromDateKeyAndTime(
      row.dateKey,
      editDraft.checkInTime,
    );
    const checkOutAt = buildTimestampFromDateKeyAndTime(
      row.dateKey,
      editDraft.checkOutTime,
    );

    if (
      checkInAt !== undefined &&
      checkOutAt !== undefined &&
      checkOutAt < checkInAt
    ) {
      setNotice({
        tone: "warning",
        text: "[VALIDATION_ERROR] Jam pulang tidak boleh lebih awal dari jam datang.",
      });
      return;
    }

    setRowActionLoading(true);
    const res = await fetch("/api/admin/attendance/edit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attendanceId: row._id,
        checkInAt,
        checkOutAt,
        reason: editDraft.reason,
      }),
    });

    if (res.ok) {
      setNotice({
        tone: "success",
        text: "Edit attendance tersimpan dan masuk audit log.",
      });
      setConfirmSaveRowId(null);
      cancelEditRow();
      await loadAttendance({ append: false, cursor: null });
      setRowActionLoading(false);
      return;
    }

    const error = await parseApiErrorResponse(res, "Edit attendance gagal.");
    setNotice({ tone: "error", text: `[${error.code}] ${error.message}` });
    setRowActionLoading(false);
  };

  const submitDate = async (e: FormEvent) => {
    e.preventDefault();
    await loadAttendance({ append: false, cursor: null });
  };

  useEffect(() => {
    void loadAttendance({ append: false, cursor: null });
    void loadReports();
    void loadScanEvents();
    void loadDeviceHeartbeat();
  }, [loadAttendance, loadReports, loadScanEvents, loadDeviceHeartbeat]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadAttendance({ append: false, cursor: null });
      void loadReports({ silent: true });
      void loadScanEvents();
      void loadDeviceHeartbeat();
    };

    window.addEventListener("dashboard:refresh", handleRefresh as EventListener);
    return () => {
      window.removeEventListener("dashboard:refresh", handleRefresh as EventListener);
    };
  }, [loadAttendance, loadDeviceHeartbeat, loadReports, loadScanEvents]);

  useEffect(() => {
    if (!reports.some((report) => report.status === "pending")) {
      return;
    }

    const interval = setInterval(() => {
      void loadReports({ silent: true });
    }, 12_000);

    return () => clearInterval(interval);
  }, [loadReports, reports]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
          Manajemen kehadiran
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Monitor absensi harian, evaluasi scan event, dan koreksi data attendance dalam satu panel.
        </p>
        {notice ? (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${noticeClass(notice.tone)}`}
          >
            {notice.text}
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {summaryCard("Total data", summary.total)}
        {summaryCard("Check-in", summary.checkedIn, "success")}
        {summaryCard("Check-out", summary.checkedOut)}
        {summaryCard("Edited", summary.edited)}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {summaryCard("Scan total", scanEventSummary.total)}
        {summaryCard("Scan accepted", scanEventSummary.accepted, "success")}
        {summaryCard("Scan rejected", scanEventSummary.rejected, "danger")}
      </section>

      <section className="sticky top-16 z-10 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur md:p-5">
        <form onSubmit={submitDate} className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto_auto] md:items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Tanggal (dateKey)</label>
            <Input value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Nama karyawan</label>
            <Input
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Cari nama"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Status edited</label>
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={editedFilter}
              onChange={(e) =>
                setEditedFilter(e.target.value as "all" | "true" | "false")
              }
            >
              <option value="all">Semua</option>
              <option value="true">Edited</option>
              <option value="false">Belum edited</option>
            </select>
          </div>
          <Button type="submit" disabled={isLoadingAttendance}>
            {isLoadingAttendance ? "Memuat..." : "Muat Data"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => loadAttendance({ append: false, cursor: null })}
            disabled={isLoadingAttendance}
          >
            Refresh
          </Button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" type="button" onClick={triggerWeeklyReport}>
            Generate Report Mingguan
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => loadReports()}
            disabled={reportsStatus === "loading"}
          >
            Refresh Report
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={() => loadScanEvents()}>
            Refresh Scan Events
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={() => loadDeviceHeartbeat()}>
            Refresh Device
          </Button>
        </div>
      </section>

      <Collapsible
        open={sectionOpen.attendance}
        onOpenChange={(open) => toggleSection("attendance", open)}
        className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <CollapsibleTrigger className="w-full text-left">
          {sectionTitle(
            "Data attendance",
            hasAttendanceFilter
              ? "Menampilkan hasil berdasarkan filter aktif."
              : "Data absensi berdasarkan tanggal terpilih.",
            `${rows.length} baris`,
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          {isLoadingAttendance && rows.length > 0 ? (
            <div className="border-b px-4 py-2 text-xs text-slate-500">
              Memuat data attendance terbaru...
            </div>
          ) : null}
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-left font-semibold text-slate-700">Nama Karyawan</th>
                <th className="p-3 text-left font-semibold text-slate-700">Tanggal</th>
                <th className="p-3 text-left font-semibold text-slate-700">Jam Datang</th>
                <th className="p-3 text-left font-semibold text-slate-700">Jam Pulang</th>
                <th className="p-3 text-left font-semibold text-slate-700">Edited</th>
                <th className="p-3 text-left font-semibold text-slate-700">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {attendanceStatus === "loading" && rows.length === 0 ? (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={6}>
                    Memuat data attendance...
                  </td>
                </tr>
              ) : attendanceStatus === "error" && attendanceError ? (
                <tr>
                  <td className="p-3" colSpan={6}>
                    <div className="flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                      <span>
                        [{attendanceError.code}] {attendanceError.message}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          loadAttendance({ append: false, cursor: null })
                        }
                      >
                        Coba lagi
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={6}>
                    {hasAttendanceFilter
                      ? "Tidak ada data attendance yang cocok dengan filter."
                      : "Belum ada data attendance untuk tanggal ini."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row._id} className="border-t border-slate-200 align-top">
                    <td className="p-3">{row.employeeName}</td>
                    <td className="p-3 tabular-nums">{row.dateKey}</td>
                    <td className="p-3 tabular-nums">
                      {editingRowId === row._id ? (
                        <Input
                          type="time"
                          value={editDraft.checkInTime}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              checkInTime: e.target.value,
                            }))
                          }
                          className="h-8 w-32"
                        />
                      ) : row.checkInAt ? (
                        new Date(row.checkInAt).toLocaleTimeString("id-ID")
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3 tabular-nums">
                      {editingRowId === row._id ? (
                        <Input
                          type="time"
                          value={editDraft.checkOutTime}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              checkOutTime: e.target.value,
                            }))
                          }
                          className="h-8 w-32"
                        />
                      ) : row.checkOutAt ? (
                        new Date(row.checkOutAt).toLocaleTimeString("id-ID")
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-1 text-xs",
                          row.edited
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : "border-slate-200 bg-slate-50 text-slate-700",
                        )}
                      >
                        {row.edited ? "Edited" : "Original"}
                      </span>
                    </td>
                    <td className="p-3">
                      {editingRowId === row._id ? (
                        <div className="flex max-w-[420px] flex-wrap items-center gap-2">
                          <Input
                            value={editDraft.reason}
                            onChange={(e) =>
                              setEditDraft((prev) => ({
                                ...prev,
                                reason: e.target.value,
                              }))
                            }
                            placeholder="Alasan edit"
                            className="h-8 w-44"
                          />
                          <Button
                            size="sm"
                            onClick={() => setConfirmSaveRowId(row._id)}
                            disabled={rowActionLoading}
                          >
                            Simpan
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEditRow}
                            disabled={rowActionLoading}
                          >
                            Batal
                          </Button>
                          {confirmSaveRowId === row._id ? (
                            <div className="w-full rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                              <p>Yakin simpan perubahan jam attendance ini?</p>
                              <div className="mt-2 flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => void saveEditRow(row)}
                                  disabled={rowActionLoading}
                                >
                                  {rowActionLoading ? "Menyimpan..." : "Ya, Simpan"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setConfirmSaveRowId(null)}
                                  disabled={rowActionLoading}
                                >
                                  Tidak
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditRow(row)}
                        >
                          Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!isLastPage ? (
            <div className="border-t border-slate-200 p-3">
              <Button
                type="button"
                variant="outline"
                onClick={loadMoreAttendance}
                disabled={isLoadingAttendance}
              >
                {isLoadingAttendance ? "Memuat..." : "Muat lagi"}
              </Button>
            </div>
          ) : null}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible
        open={sectionOpen.scanEvents}
        onOpenChange={(open) => toggleSection("scanEvents", open)}
        className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <CollapsibleTrigger className="w-full text-left">
          {sectionTitle(
            "Scan events",
            `Breakdown reason untuk ${dateKey}.`,
            `${scanEvents.length} event`,
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-wrap gap-2 text-xs">
              {scanEventSummary.byReason.slice(0, 8).map((item) => (
                <span
                  key={item.reasonCode}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700"
                >
                  {item.reasonCode}: {item.count}
                </span>
              ))}
              {scanEventSummary.byReason.length === 0 ? (
                <span className="text-slate-500">Belum ada breakdown reason.</span>
              ) : null}
            </div>
          </div>
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-left font-semibold text-slate-700">Waktu</th>
                <th className="p-3 text-left font-semibold text-slate-700">Karyawan</th>
                <th className="p-3 text-left font-semibold text-slate-700">Result</th>
                <th className="p-3 text-left font-semibold text-slate-700">Reason</th>
                <th className="p-3 text-left font-semibold text-slate-700">Message</th>
              </tr>
            </thead>
            <tbody>
              {scanEventsStatus === "loading" ? (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={5}>
                    Memuat scan events...
                  </td>
                </tr>
              ) : scanEvents.length === 0 ? (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={5}>
                    Belum ada scan events.
                  </td>
                </tr>
              ) : (
                scanEvents.map((row) => (
                  <tr key={row._id} className="border-t border-slate-200">
                    <td className="p-3 tabular-nums">
                      {new Date(row.scannedAt).toLocaleTimeString("id-ID")}
                    </td>
                    <td className="p-3">
                      {row.actorName}
                      <div className="text-xs text-slate-500">{row.actorEmail}</div>
                    </td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-1 text-xs",
                          row.resultStatus === "accepted"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : "border-rose-200 bg-rose-50 text-rose-900",
                        )}
                      >
                        {row.resultStatus}
                      </span>
                    </td>
                    <td className="p-3">{row.reasonCode}</td>
                    <td className="p-3">{row.message ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible
        open={sectionOpen.device}
        onOpenChange={(open) => toggleSection("device", open)}
        className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <CollapsibleTrigger className="w-full text-left">
          {sectionTitle(
            "Status device QR",
            "Monitoring heartbeat akun device-qr.",
            `${deviceRows.length} device`,
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-left font-semibold text-slate-700">Nama</th>
                <th className="p-3 text-left font-semibold text-slate-700">Email</th>
                <th className="p-3 text-left font-semibold text-slate-700">Online</th>
                <th className="p-3 text-left font-semibold text-slate-700">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {deviceStatus === "loading" ? (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={4}>
                    Memuat status device...
                  </td>
                </tr>
              ) : deviceRows.length === 0 ? (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={4}>
                    Tidak ada akun device-qr aktif.
                  </td>
                </tr>
              ) : (
                deviceRows.map((row) => (
                  <tr key={row.deviceUserId} className="border-t border-slate-200">
                    <td className="p-3">{row.name}</td>
                    <td className="p-3">{row.email}</td>
                    <td className="p-3">{row.online ? "Online" : "Offline"}</td>
                    <td className="p-3 tabular-nums">
                      {row.lastSeenAt
                        ? new Date(row.lastSeenAt).toLocaleString("id-ID")
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible
        open={sectionOpen.weekly}
        onOpenChange={(open) => toggleSection("weekly", open)}
        className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <CollapsibleTrigger className="w-full text-left">
          {sectionTitle(
            "Riwayat report mingguan",
            "Daftar report ter-generate dari trigger manual atau cron.",
            `${reports.length} report`,
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-left font-semibold text-slate-700">Week Key</th>
                <th className="p-3 text-left font-semibold text-slate-700">Range</th>
                <th className="p-3 text-left font-semibold text-slate-700">Status</th>
                <th className="p-3 text-left font-semibold text-slate-700">Source</th>
                <th className="p-3 text-left font-semibold text-slate-700">Attempt</th>
                <th className="p-3 text-left font-semibold text-slate-700">Durasi</th>
                <th className="p-3 text-left font-semibold text-slate-700">Error</th>
                <th className="p-3 text-left font-semibold text-slate-700">Generated At</th>
                <th className="p-3 text-left font-semibold text-slate-700">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {reportsStatus === "loading" && reports.length === 0 ? (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={9}>
                    Memuat riwayat report mingguan...
                  </td>
                </tr>
              ) : reportsStatus === "error" && reportsError ? (
                <tr>
                  <td className="p-3" colSpan={9}>
                    <div className="flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                      <span>
                        [{reportsError.code}] {reportsError.message}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => loadReports()}
                      >
                        Coba lagi
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={9}>
                    Belum ada report mingguan.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report._id} className="border-t border-slate-200">
                    <td className="p-3 tabular-nums">{report.weekKey}</td>
                    <td className="p-3 tabular-nums">
                      {report.startDate} s/d {report.endDate}
                    </td>
                    <td className="p-3">{report.status}</td>
                    <td className="p-3">{report.triggerSource ?? "-"}</td>
                    <td className="p-3 tabular-nums">{report.attempts ?? 1}</td>
                    <td className="p-3 tabular-nums">
                      {report.durationMs !== undefined
                        ? `${Math.max(0, Math.round(report.durationMs / 1000))} detik`
                        : "-"}
                    </td>
                    <td className="max-w-[320px] truncate p-3">
                      {report.status === "failed"
                        ? (report.errorMessage ?? "-")
                        : "-"}
                    </td>
                    <td className="p-3 tabular-nums">
                      {report.generatedAt
                        ? new Date(report.generatedAt).toLocaleString("id-ID")
                        : "-"}
                    </td>
                    <td className="p-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={report.status !== "success"}
                        onClick={() => downloadReport(report._id)}
                      >
                        Unduh
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
