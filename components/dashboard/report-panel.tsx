"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  finishReportToolbarAction,
  isReportToolbarActionPending,
  startReportToolbarAction,
  type ReportToolbarAction,
  type ReportToolbarPendingState,
} from "@/components/dashboard/report-panel-state";
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
  PopoverPopup,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/menu";
import { parseApiErrorResponse } from "@/lib/client-error";
import type { ApiErrorInfo } from "@/lib/client-error";
import { getLocalDateKey } from "@/lib/date-key";
import {
  buildActiveAuditFilterBadges,
  buildAttendanceSectionCountLabel,
  buildAttendanceSearchParams,
  buildScanEventsSectionCountLabel,
  buildScanEventsSearchParams,
  refreshAttendanceAuditSections,
} from "@/lib/report-panel-behavior";
import { formatClockInTimeZone, isValidClockValue } from "@/lib/timezone-clock";
import { cn } from "@/lib/utils";
import {
  formatWeeklyReportFileMeta,
  formatWeeklyReportSourceLabel,
  formatWeeklyReportStatusLabel,
  getWeeklyReportStatusTone,
  getWeeklyReportTimestampMeta,
} from "@/lib/weekly-report-presentation";
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
  byteLength?: number;
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
  timezone: string;
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
  searchQueryOverride?: string;
  dateKeyOverride?: string;
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

type SectionKey = "attendance" | "scanEvents" | "weekly";
type AttendanceStatusFilter =
  | "all"
  | "not-checked-in"
  | "checked-in"
  | "incomplete"
  | "completed";
type ScanResultFilter = "all" | "accepted" | "rejected";

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
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50/40"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50/40"
        : "border-zinc-200 bg-white";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-hover hover:shadow-md",
        toneClass,
      )}
    >
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
  const searchParams = useSearchParams();
  const headerQuery = (searchParams.get("q") ?? "").trim();
  const initialDateKey = getLocalDateKey();
  const [draftDateKey, setDraftDateKey] = useState(initialDateKey);
  const [activeDateKey, setActiveDateKey] = useState(initialDateKey);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({
    total: 0,
    checkedIn: 0,
    checkedOut: 0,
    edited: 0,
  });
  const [employeeName, setEmployeeName] = useState(headerQuery);
  const [editedFilter, setEditedFilter] = useState<"all" | "true" | "false">(
    "all",
  );
  const [attendanceStatusFilter, setAttendanceStatusFilter] =
    useState<AttendanceStatusFilter>("all");
  const [scanResultFilter, setScanResultFilter] =
    useState<ScanResultFilter>("all");
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
  const [confirmSaveRow, setConfirmSaveRow] = useState<AttendanceRow | null>(null);
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
  const [toolbarPendingState, setToolbarPendingState] =
    useState<ReportToolbarPendingState>({});
  const hasLoadedInitial = useRef(false);
  const prevHeaderQueryRef = useRef(headerQuery);
  const [workspaceTimezone, setWorkspaceTimezone] = useState("Asia/Jakarta");
  const [sectionOpen, setSectionOpen] = useState<Record<SectionKey, boolean>>({
    attendance: true,
    scanEvents: true,
    weekly: true,
  });

  const hasAttendanceFilter =
    employeeName.trim().length > 0 || editedFilter !== "all";

  const toggleSection = (key: SectionKey, open: boolean) => {
    setSectionOpen((prev) => ({ ...prev, [key]: open }));
  };

  const runToolbarAction = useCallback(
    async (action: ReportToolbarAction, operation: () => Promise<void>) => {
      setToolbarPendingState((prev) => startReportToolbarAction(prev, action));
      try {
        await operation();
      } finally {
        setToolbarPendingState((prev) =>
          finishReportToolbarAction(prev, action),
        );
      }
    },
    [],
  );

  const buildAttendanceParams = useCallback(
    (
      cursor: string | null,
      searchQueryOverride?: string,
      dateKeyOverride?: string,
    ) => {
      const query =
        searchQueryOverride === undefined
          ? employeeName.trim()
          : searchQueryOverride.trim();
      return buildAttendanceSearchParams({
        dateKey: dateKeyOverride ?? activeDateKey,
        employeeName: query,
        editedFilter,
        attendanceStatusFilter,
        cursor,
      });
    },
    [activeDateKey, attendanceStatusFilter, editedFilter, employeeName],
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
          `/api/admin/attendance?${buildAttendanceParams(
            opts.cursor,
            opts.searchQueryOverride,
            opts.dateKeyOverride,
          )}`,
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
        setWorkspaceTimezone(data.timezone);
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
    await runToolbarAction("load-more-attendance", async () => {
      await loadAttendance({ append: true, cursor: nextCursor });
    });
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

  const loadScanEvents = useCallback(async (dateKeyOverride?: string) => {
    const targetDateKey = dateKeyOverride ?? activeDateKey;
    setScanEventsStatus("loading");
    const res = await workspaceFetch(
      `/api/admin/attendance/scan-events?${buildScanEventsSearchParams({
        dateKey: targetDateKey,
        scanResultFilter,
      })}`,
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
  }, [activeDateKey, scanResultFilter]);

  const triggerWeeklyReport = async () => {
    await runToolbarAction("trigger-weekly", async () => {
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
    });
  };

  const downloadReport = (reportId: string) => {
    window.location.assign(
      `/api/admin/reports/download?reportId=${encodeURIComponent(reportId)}`,
    );
  };

  const formatTimeInput = (value?: number) => {
    return formatClockInTimeZone(value, workspaceTimezone);
  };

  const startEditRow = (row: AttendanceRow) => {
    setEditingRowId(row._id);
    setConfirmSaveRow(null);
    setEditDraft({
      checkInTime: formatTimeInput(row.checkInAt),
      checkOutTime: formatTimeInput(row.checkOutAt),
      reason: "Koreksi admin",
    });
  };

  const cancelEditRow = () => {
    setEditingRowId(null);
    setConfirmSaveRow(null);
    setEditDraft({
      checkInTime: "",
      checkOutTime: "",
      reason: "Koreksi admin",
    });
  };

  const resolveEditRowPayload = (row: AttendanceRow) => {
    if (!editDraft.reason.trim()) {
      return {
        ok: false as const,
        message: "[VALIDATION_ERROR] Alasan edit wajib diisi.",
      };
    }

    const checkInTime = editDraft.checkInTime.trim();
    const checkOutTime = editDraft.checkOutTime.trim();

    if (
      (checkInTime.length > 0 && !isValidClockValue(checkInTime)) ||
      (checkOutTime.length > 0 && !isValidClockValue(checkOutTime))
    ) {
      return {
        ok: false as const,
        message: "[VALIDATION_ERROR] Format jam attendance tidak valid.",
      };
    }

    if (
      checkInTime.length > 0 &&
      checkOutTime.length > 0 &&
      checkOutTime < checkInTime
    ) {
      return {
        ok: false as const,
        message: "[VALIDATION_ERROR] Jam pulang tidak boleh lebih awal dari jam datang.",
      };
    }

    return {
      ok: true as const,
      payload: {
        attendanceId: row._id,
        dateKey: row.dateKey,
        checkInTime: checkInTime.length > 0 ? checkInTime : undefined,
        checkOutTime: checkOutTime.length > 0 ? checkOutTime : undefined,
        reason: editDraft.reason.trim(),
      },
    };
  };

  const requestSaveEditRow = (row: AttendanceRow) => {
    const result = resolveEditRowPayload(row);
    if (!result.ok) {
      setNotice({
        tone: "warning",
        text: result.message,
      });
      return;
    }

    setConfirmSaveRow(row);
  };

  const saveEditRow = async () => {
    if (!confirmSaveRow) {
      return;
    }

    const result = resolveEditRowPayload(confirmSaveRow);
    if (!result.ok) {
      setNotice({
        tone: "warning",
        text: result.message,
      });
      setConfirmSaveRow(null);
      return;
    }

    setRowActionLoading(true);
    try {
      const res = await workspaceFetch("/api/admin/attendance/edit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });

      if (res.ok) {
        setNotice({
          tone: "success",
          text: "Edit attendance tersimpan dan masuk audit log.",
        });
        cancelEditRow();
        await loadAttendance({ append: false, cursor: null });
        return;
      }

      const error = await parseApiErrorResponse(res, "Edit attendance gagal.");
      if (recoverWorkspaceScopeViolation(error.code)) {
        return;
      }
      setNotice({ tone: "error", text: `[${error.code}] ${error.message}` });
    } finally {
      setConfirmSaveRow(null);
      setRowActionLoading(false);
    }
  };

  const submitDate = async (e: FormEvent) => {
    e.preventDefault();
    const nextDateKey = draftDateKey;
    await runToolbarAction("submit-attendance", async () => {
      setActiveDateKey(nextDateKey);
      await refreshAttendanceAuditSections({
        loadAttendance: () =>
          loadAttendance({
            append: false,
            cursor: null,
            dateKeyOverride: nextDateKey,
          }),
        loadScanEvents: () => loadScanEvents(nextDateKey),
      });
    });
  };

  const handleRefreshAttendance = async (action: "refresh-attendance" | "retry-attendance" = "refresh-attendance") => {
    await runToolbarAction(action, async () => {
      await refreshAttendanceAuditSections({
        loadAttendance: () => loadAttendance({ append: false, cursor: null }),
        loadScanEvents: () => loadScanEvents(),
      });
    });
  };

  const handleRefreshReports = async (action: "refresh-reports" | "retry-reports" = "refresh-reports") => {
    await runToolbarAction(action, async () => {
      await loadReports();
    });
  };

  const handleRefreshScanEvents = async () => {
    await runToolbarAction("refresh-scan-events", async () => {
      await loadScanEvents();
    });
  };

  const resetFilters = async () => {
    setEmployeeName(headerQuery);
    setEditedFilter("all");
    setAttendanceStatusFilter("all");
    setScanResultFilter("all");
    await runToolbarAction("refresh-attendance", async () => {
      await refreshAttendanceAuditSections({
        loadAttendance: () =>
          loadAttendance({
            append: false,
            cursor: null,
            searchQueryOverride: headerQuery,
          }),
        loadScanEvents: () => loadScanEvents(),
      });
    });
  };

  useEffect(() => {
    if (hasLoadedInitial.current) return;
    hasLoadedInitial.current = true;
    void loadAttendance({ append: false, cursor: null, dateKeyOverride: activeDateKey });
    void loadReports();
    void loadScanEvents(activeDateKey);
  }, [activeDateKey, loadAttendance, loadReports, loadScanEvents]);

  useEffect(() => {
    if (prevHeaderQueryRef.current === headerQuery) return;
    prevHeaderQueryRef.current = headerQuery;
    setEmployeeName(headerQuery);
    void loadAttendance({
      append: false,
      cursor: null,
      searchQueryOverride: headerQuery,
      dateKeyOverride: activeDateKey,
    });
  }, [activeDateKey, headerQuery, loadAttendance]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadAttendance({ append: false, cursor: null, dateKeyOverride: activeDateKey });
      void loadReports({ silent: true });
      void loadScanEvents(activeDateKey);
    };

    window.addEventListener("dashboard:refresh", handleRefresh as EventListener);
    return () => {
      window.removeEventListener("dashboard:refresh", handleRefresh as EventListener);
    };
  }, [activeDateKey, loadAttendance, loadReports, loadScanEvents]);

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
      <ConfirmationDialog
        open={Boolean(confirmSaveRow)}
        title="Simpan perubahan attendance ini?"
        description={
          confirmSaveRow
            ? `Perubahan jam attendance untuk ${confirmSaveRow.employeeName} pada ${confirmSaveRow.dateKey} akan masuk ke audit log.`
            : ""
        }
        confirmLabel="Ya, Simpan"
        cancelLabel="Batal"
        isPending={rowActionLoading}
        onConfirm={() => {
          void saveEditRow();
        }}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmSaveRow(null);
          }
        }}
      />

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
        <form
          onSubmit={submitDate}
          className="grid gap-3 md:grid-cols-2 md:items-end xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_180px_180px_auto_auto_auto]"
        >
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">Tanggal (dateKey)</label>
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10 border-zinc-200 bg-white px-3 text-sm",
                      !draftDateKey && "text-zinc-500"
                    )}
                  />
                }
              >
                <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                {draftDateKey ? format(new Date(draftDateKey + "T00:00:00"), "dd MMM yyyy") : <span>Pilih tanggal</span>}
              </PopoverTrigger>
              <PopoverPopup className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={draftDateKey ? new Date(draftDateKey + "T00:00:00") : undefined}
                  onSelect={(date) => {
                    if (date) setDraftDateKey(format(date, "yyyy-MM-dd"));
                  }}
                  initialFocus
                />
              </PopoverPopup>
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
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    variant="outline"
                    className="h-10 w-full justify-between border-zinc-200 bg-white px-3 text-sm font-normal"
                  />
                }
              >
                {editedFilter === "all"
                  ? "Semua"
                  : editedFilter === "true"
                    ? "Edited"
                    : "Belum edited"}
                <ChevronDown className="h-4 w-4 opacity-70" />
              </MenuTrigger>
              <MenuPopup align="start" className="w-[var(--anchor-width)]">
                <MenuRadioGroup
                  value={editedFilter}
                  onValueChange={(value) =>
                    setEditedFilter(value as "all" | "true" | "false")
                  }
                >
                  <MenuRadioItem value="all">Semua</MenuRadioItem>
                  <MenuRadioItem value="true">Edited</MenuRadioItem>
                  <MenuRadioItem value="false">Belum edited</MenuRadioItem>
                </MenuRadioGroup>
              </MenuPopup>
            </Menu>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">Status attendance</label>
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    variant="outline"
                    className="h-10 w-full justify-between border-zinc-200 bg-white px-3 text-sm font-normal"
                  />
                }
              >
                {attendanceStatusFilter === "all"
                  ? "Semua"
                  : attendanceStatusFilter === "not-checked-in"
                    ? "Belum check-in"
                    : attendanceStatusFilter === "checked-in"
                      ? "Sudah check-in"
                      : attendanceStatusFilter === "incomplete"
                        ? "Belum check-out"
                        : "Lengkap"}
                <ChevronDown className="h-4 w-4 opacity-70" />
              </MenuTrigger>
              <MenuPopup align="start" className="w-[var(--anchor-width)]">
                <MenuRadioGroup
                  value={attendanceStatusFilter}
                  onValueChange={(value) =>
                    setAttendanceStatusFilter(value as AttendanceStatusFilter)
                  }
                >
                  <MenuRadioItem value="all">Semua</MenuRadioItem>
                  <MenuRadioItem value="not-checked-in">Belum check-in</MenuRadioItem>
                  <MenuRadioItem value="checked-in">Sudah check-in</MenuRadioItem>
                  <MenuRadioItem value="incomplete">Belum check-out</MenuRadioItem>
                  <MenuRadioItem value="completed">Lengkap</MenuRadioItem>
                </MenuRadioGroup>
              </MenuPopup>
            </Menu>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-600">Result scan</label>
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    variant="outline"
                    className="h-10 w-full justify-between border-zinc-200 bg-white px-3 text-sm font-normal"
                  />
                }
              >
                {scanResultFilter === "all"
                  ? "Semua"
                  : scanResultFilter}
                <ChevronDown className="h-4 w-4 opacity-70" />
              </MenuTrigger>
              <MenuPopup align="start" className="w-[var(--anchor-width)]">
                <MenuRadioGroup
                  value={scanResultFilter}
                  onValueChange={(value) =>
                    setScanResultFilter(value as ScanResultFilter)
                  }
                >
                  <MenuRadioItem value="all">Semua</MenuRadioItem>
                  <MenuRadioItem value="accepted">accepted</MenuRadioItem>
                  <MenuRadioItem value="rejected">rejected</MenuRadioItem>
                </MenuRadioGroup>
              </MenuPopup>
            </Menu>
          </div>
          <Button
            type="submit"
            disabled={isLoadingAttendance}
            isLoading={isReportToolbarActionPending(
              toolbarPendingState,
              "submit-attendance",
            )}
            loadingText="Memuat..."
          >
            Muat Data
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleRefreshAttendance()}
            disabled={isLoadingAttendance}
            isLoading={isReportToolbarActionPending(
              toolbarPendingState,
              "refresh-attendance",
            )}
          >
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void resetFilters()}
          >
            Reset Filter
          </Button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {buildActiveAuditFilterBadges({
            activeDateKey,
            employeeName,
            editedFilter,
            attendanceStatusFilter,
            scanResultFilter,
          }).map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-700"
            >
              {badge}
            </span>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => void triggerWeeklyReport()}
            isLoading={isReportToolbarActionPending(
              toolbarPendingState,
              "trigger-weekly",
            )}
          >
            Generate Report Mingguan
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => void handleRefreshReports()}
            disabled={reportsStatus === "loading"}
            isLoading={isReportToolbarActionPending(
              toolbarPendingState,
              "refresh-reports",
            )}
          >
            Refresh Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => void handleRefreshScanEvents()}
            isLoading={isReportToolbarActionPending(
              toolbarPendingState,
              "refresh-scan-events",
            )}
          >
            Refresh Scan Events
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
              : `Data absensi untuk ${activeDateKey}.`,
            buildAttendanceSectionCountLabel({
              loadedCount: rows.length,
              totalCount: summary.total,
            }),
          )}
        </CollapsibleTrigger>
        <CollapsiblePanel>
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
                        onClick={() => void handleRefreshAttendance("retry-attendance")}
                        isLoading={isReportToolbarActionPending(
                          toolbarPendingState,
                          "retry-attendance",
                        )}
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
                        new Date(row.checkInAt).toLocaleTimeString("id-ID", {
                          timeZone: workspaceTimezone,
                        })
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
                        new Date(row.checkOutAt).toLocaleTimeString("id-ID", {
                          timeZone: workspaceTimezone,
                        })
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
                            onClick={() => requestSaveEditRow(row)}
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
                isLoading={isReportToolbarActionPending(
                  toolbarPendingState,
                  "load-more-attendance",
                )}
              >
                Muat lagi
              </Button>
            </div>
          ) : null}
        </CollapsiblePanel>
      </Collapsible>

      <Collapsible
        open={sectionOpen.scanEvents}
        onOpenChange={(open) => toggleSection("scanEvents", open)}
        className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
      >
        <CollapsibleTrigger className="w-full text-left">
          {sectionTitle(
            "Scan events",
            `Breakdown reason untuk ${activeDateKey}.`,
            buildScanEventsSectionCountLabel({
              loadedCount: scanEvents.length,
              totalCount: scanEventSummary.total,
            }),
          )}
        </CollapsibleTrigger>
        <CollapsiblePanel>
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
                      {new Date(row.scannedAt).toLocaleTimeString("id-ID", {
                        timeZone: workspaceTimezone,
                      })}
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
        </CollapsiblePanel>
      </Collapsible>

      <Collapsible
        open={sectionOpen.weekly}
        onOpenChange={(open) => toggleSection("weekly", open)}
        className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
      >
        <CollapsibleTrigger className="w-full text-left">
          {sectionTitle(
            "Riwayat report mingguan",
            "Status generate, file output, dan error terbaru untuk audit mingguan.",
            `${reports.length} report`,
          )}
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Week Key</TableHead>
                <TableHead>Range</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>Durasi</TableHead>
                <TableHead>Waktu</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportsStatus === "loading" && reports.length === 0 ? (
                <TableRow>
                  <TableCell className="text-zinc-500" colSpan={10}>
                    Memuat riwayat report mingguan...
                  </TableCell>
                </TableRow>
              ) : reportsStatus === "error" && reportsError ? (
                <TableRow>
                  <TableCell colSpan={10}>
                    <div className="flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                      <span>
                        [{reportsError.code}] {reportsError.message}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleRefreshReports("retry-reports")}
                        isLoading={isReportToolbarActionPending(
                          toolbarPendingState,
                          "retry-reports",
                        )}
                      >
                        Coba lagi
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell className="text-zinc-500" colSpan={10}>
                    Belum ada report mingguan.
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => {
                  const statusTone = getWeeklyReportStatusTone(report.status);
                  const fileMeta = formatWeeklyReportFileMeta(report);
                  const timestampMeta = getWeeklyReportTimestampMeta(report);

                  return (
                    <TableRow key={report._id}>
                      <TableCell className="tabular-nums">{report.weekKey}</TableCell>
                      <TableCell className="tabular-nums">
                        {report.startDate} s/d {report.endDate}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-1 text-xs font-medium",
                            statusTone === "success"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : statusTone === "danger"
                                ? "border-rose-200 bg-rose-50 text-rose-900"
                                : "border-amber-200 bg-amber-50 text-amber-900",
                          )}
                        >
                          {formatWeeklyReportStatusLabel(report.status)}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        <div className="font-medium text-zinc-900">{fileMeta.primary}</div>
                        <div className="text-xs text-zinc-500">{fileMeta.secondary}</div>
                      </TableCell>
                      <TableCell>{formatWeeklyReportSourceLabel(report.triggerSource)}</TableCell>
                      <TableCell className="tabular-nums">{report.attempts ?? 1}</TableCell>
                      <TableCell className="tabular-nums">
                        {report.durationMs !== undefined
                          ? `${Math.max(0, Math.round(report.durationMs / 1000))} detik`
                          : "-"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        <div className="font-medium text-zinc-900">{timestampMeta.value}</div>
                        <div className="text-xs text-zinc-500">{timestampMeta.label}</div>
                      </TableCell>
                      <TableCell
                        className="max-w-[320px] whitespace-normal break-words text-sm text-zinc-600"
                        title={report.status === "failed" ? report.errorMessage ?? "-" : undefined}
                      >
                        {report.status === "failed" ? (report.errorMessage ?? "-") : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={report.status !== "success"}
                          onClick={() => downloadReport(report._id)}
                        >
                          {report.status === "success"
                            ? "Unduh"
                            : report.status === "pending"
                              ? "Diproses"
                              : "Tidak siap"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CollapsiblePanel>
      </Collapsible>
    </div>
  );
}
