"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { recoverWorkspaceScopeViolation, workspaceFetch } from "@/lib/workspace-client";

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
      return "border-rose-200 bg-rose-50/50 text-rose-900";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-900";
  }
}

function summaryCard(
  label: string,
  value: number,
  tone: "default" | "success" | "danger" = "default",
) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-hover hover:shadow-md">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <div className="mt-4 flex items-baseline gap-1 relative z-10">
        <p className="text-3xl font-semibold tabular-nums text-zinc-800 tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function sectionTitle(title: string, description: string, countLabel?: string) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 px-6 py-5">
      <div className="text-left flex flex-col items-start">
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">{title}</h2>
        <p className="mt-1 text-xs text-zinc-500">{description}</p>
      </div>
      {countLabel ? (
        <span className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-semibold tracking-wide text-zinc-600">
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
        const res = await workspaceFetch(
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
          if (recoverWorkspaceScopeViolation(error.code)) {
            return;
          }
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

    const res = await workspaceFetch("/api/admin/reports", { cache: "no-store" });
    if (!res.ok) {
      const error = await parseApiErrorResponse(
        res,
        "Gagal memuat daftar report mingguan.",
      );
      if (recoverWorkspaceScopeViolation(error.code)) {
        return;
      }
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
    const res = await workspaceFetch(
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
    const res = await workspaceFetch("/api/admin/device/heartbeat", {
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
    const res = await workspaceFetch("/api/admin/reports", { method: "POST" });
    if (!res.ok) {
      const error = await parseApiErrorResponse(
        res,
        "Gagal memproses trigger report mingguan.",
      );
      if (recoverWorkspaceScopeViolation(error.code)) {
        return;
      }
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
    const res = await workspaceFetch("/api/admin/attendance/edit", {
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
    if (recoverWorkspaceScopeViolation(error.code)) {
      return;
    }
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
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-gradient-to-r from-white to-zinc-100/70 p-4 shadow-sm md:p-5">
        <p className="text-sm font-semibold tracking-tight text-zinc-900">Kontrol kehadiran & audit data</p>
        <p className="mt-1 text-sm text-zinc-600">
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

      <section className="grid gap-4 md:grid-cols-4">
        {summaryCard("Total data", summary.total)}
        {summaryCard("Check-in", summary.checkedIn, "success")}
        {summaryCard("Check-out", summary.checkedOut)}
        {summaryCard("Edited", summary.edited)}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {summaryCard("Scan total", scanEventSummary.total)}
        {summaryCard("Scan accepted", scanEventSummary.accepted, "success")}
        {summaryCard("Scan rejected", scanEventSummary.rejected, "danger")}
      </section>

      <section className="sticky top-3 z-10 rounded-xl border border-zinc-200 bg-white/95 p-4 shadow-sm backdrop-blur md:p-5">
        <form onSubmit={submitDate} className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto_auto] md:items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">Tanggal (dateKey)</label>
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10 border-zinc-200 bg-white px-3 text-sm",
                      !dateKey && "text-zinc-500"
                    )}
                  />
                }
              >
                <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                {dateKey ? format(new Date(dateKey + "T00:00:00"), "dd MMM yyyy") : <span>Pilih tanggal</span>}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateKey ? new Date(dateKey + "T00:00:00") : undefined}
                  onSelect={(date) => {
                    if (date) setDateKey(format(date, "yyyy-MM-dd"));
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">Nama karyawan</label>
            <Input
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Cari nama"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">Status edited</label>
            <select
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
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
        className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
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
            <div className="border-b px-4 py-2 text-xs text-zinc-500">
              Memuat data attendance terbaru...
            </div>
          ) : null}
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nama Karyawan</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Jam Datang</TableHead>
                <TableHead>Jam Pulang</TableHead>
                <TableHead>Edited</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceStatus === "loading" && rows.length === 0 ? (
                <TableRow>
                  <TableCell className="text-zinc-500" colSpan={6}>
                    Memuat data attendance...
                  </TableCell>
                </TableRow>
              ) : attendanceStatus === "error" && attendanceError ? (
                <TableRow>
                  <TableCell colSpan={6}>
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
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell className="text-zinc-500" colSpan={6}>
                    {hasAttendanceFilter
                      ? "Tidak ada data attendance yang cocok dengan filter."
                      : "Belum ada data attendance untuk tanggal ini."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row._id} className="align-top">
                    <TableCell>{row.employeeName}</TableCell>
                    <TableCell className="tabular-nums">{row.dateKey}</TableCell>
                    <TableCell className="tabular-nums">
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
                    </TableCell>
                    <TableCell className="tabular-nums">
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
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-1 text-xs",
                          row.edited
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700",
                        )}
                      >
                        {row.edited ? "Edited" : "Original"}
                      </span>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {!isLastPage ? (
            <div className="border-t border-zinc-200 p-3">
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
        className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
      >
        <CollapsibleTrigger className="w-full text-left">
          {sectionTitle(
            "Scan events",
            `Breakdown reason untuk ${dateKey}.`,
            `${scanEvents.length} event`,
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-b border-zinc-200 p-4">
            <div className="flex flex-wrap gap-2 text-xs">
              {scanEventSummary.byReason.slice(0, 8).map((item) => (
                <span
                  key={item.reasonCode}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-700"
                >
                  {item.reasonCode}: {item.count}
                </span>
              ))}
              {scanEventSummary.byReason.length === 0 ? (
                <span className="text-zinc-500">Belum ada breakdown reason.</span>
              ) : null}
            </div>
          </div>
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Karyawan</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scanEventsStatus === "loading" ? (
                <TableRow>
                  <TableCell className="text-zinc-500" colSpan={5}>
                    Memuat scan events...
                  </TableCell>
                </TableRow>
              ) : scanEvents.length === 0 ? (
                <TableRow>
                  <TableCell className="text-zinc-500" colSpan={5}>
                    Belum ada scan events.
                  </TableCell>
                </TableRow>
              ) : (
                scanEvents.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell className="tabular-nums">
                      {new Date(row.scannedAt).toLocaleTimeString("id-ID")}
                    </TableCell>
                    <TableCell>
                      {row.actorName}
                      <div className="text-xs text-zinc-500">{row.actorEmail}</div>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>{row.reasonCode}</TableCell>
                    <TableCell>{row.message ?? "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible
        open={sectionOpen.device}
        onOpenChange={(open) => toggleSection("device", open)}
        className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
      >
        <CollapsibleTrigger className="w-full text-left">
          {sectionTitle(
            "Status device QR",
            "Monitoring heartbeat akun device-qr.",
            `${deviceRows.length} device`,
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Online</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deviceStatus === "loading" ? (
                <TableRow>
                  <TableCell className="text-zinc-500" colSpan={4}>
                    Memuat status device...
                  </TableCell>
                </TableRow>
              ) : deviceRows.length === 0 ? (
                <TableRow>
                  <TableCell className="text-zinc-500" colSpan={4}>
                    Tidak ada akun device-qr aktif.
                  </TableCell>
                </TableRow>
              ) : (
                deviceRows.map((row) => (
                  <TableRow key={row.deviceUserId}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.online ? "Online" : "Offline"}</TableCell>
                    <TableCell className="tabular-nums">
                      {row.lastSeenAt
                        ? new Date(row.lastSeenAt).toLocaleString("id-ID")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible
        open={sectionOpen.weekly}
        onOpenChange={(open) => toggleSection("weekly", open)}
        className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
      >
        <CollapsibleTrigger className="w-full text-left">
          {sectionTitle(
            "Riwayat report mingguan",
            "Daftar report ter-generate dari trigger manual atau cron.",
            `${reports.length} report`,
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Week Key</TableHead>
                <TableHead>Range</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>Durasi</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Generated At</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportsStatus === "loading" && reports.length === 0 ? (
                <TableRow>
                  <TableCell className="text-zinc-500" colSpan={9}>
                    Memuat riwayat report mingguan...
                  </TableCell>
                </TableRow>
              ) : reportsStatus === "error" && reportsError ? (
                <TableRow>
                  <TableCell colSpan={9}>
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
                  </TableCell>
                </TableRow>
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell className="text-zinc-500" colSpan={9}>
                    Belum ada report mingguan.
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow key={report._id}>
                    <TableCell className="tabular-nums">{report.weekKey}</TableCell>
                    <TableCell className="tabular-nums">
                      {report.startDate} s/d {report.endDate}
                    </TableCell>
                    <TableCell>{report.status}</TableCell>
                    <TableCell>{report.triggerSource ?? "-"}</TableCell>
                    <TableCell className="tabular-nums">{report.attempts ?? 1}</TableCell>
                    <TableCell className="tabular-nums">
                      {report.durationMs !== undefined
                        ? `${Math.max(0, Math.round(report.durationMs / 1000))} detik`
                        : "-"}
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate">
                      {report.status === "failed"
                        ? (report.errorMessage ?? "-")
                        : "-"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {report.generatedAt
                        ? new Date(report.generatedAt).toLocaleString("id-ID")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={report.status !== "success"}
                        onClick={() => downloadReport(report._id)}
                      >
                        Unduh
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
