"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseApiErrorResponse } from "@/lib/client-error";
import type { ApiErrorInfo } from "@/lib/client-error";
import { getLocalDateKey } from "@/lib/date-key";

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

type PanelStatus = "idle" | "loading" | "success" | "empty" | "error";
type NoticeTone = "info" | "success" | "warning" | "error";

type InlineNotice = {
  tone: NoticeTone;
  text: string;
};

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
  const [reason, setReason] = useState("Koreksi admin");
  const [reports, setReports] = useState<WeeklyReportRow[]>([]);
  const hasAttendanceFilter =
    employeeName.trim().length > 0 || editedFilter !== "all";

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

  const editRow = async (attendanceId: string) => {
    if (!reason.trim()) {
      setNotice({
        tone: "warning",
        text: "[VALIDATION_ERROR] Alasan edit wajib diisi.",
      });
      return;
    }

    const res = await fetch("/api/admin/attendance/edit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceId, reason }),
    });

    if (res.ok) {
      setNotice({
        tone: "success",
        text: "Edit attendance tersimpan dan masuk audit log.",
      });
      await loadAttendance({ append: false, cursor: null });
      return;
    }

    const error = await parseApiErrorResponse(res, "Edit attendance gagal.");
    setNotice({ tone: "error", text: `[${error.code}] ${error.message}` });
  };

  const submitDate = async (e: FormEvent) => {
    e.preventDefault();
    await loadAttendance({ append: false, cursor: null });
  };

  useEffect(() => {
    void loadAttendance({ append: false, cursor: null });
    void loadReports();
  }, [loadAttendance, loadReports]);

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
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border p-4">
          <p className="text-muted-foreground text-xs">Total Data</p>
          <p className="mt-2 text-2xl font-bold">{summary.total}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-muted-foreground text-xs">Check-In</p>
          <p className="mt-2 text-2xl font-bold">{summary.checkedIn}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-muted-foreground text-xs">Check-Out</p>
          <p className="mt-2 text-2xl font-bold">{summary.checkedOut}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-muted-foreground text-xs">Edited</p>
          <p className="mt-2 text-2xl font-bold">{summary.edited}</p>
        </div>
      </section>

      <section className="rounded-xl border p-4">
        <form onSubmit={submitDate} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Tanggal (dateKey)
            </label>
            <Input
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Nama Karyawan
            </label>
            <Input
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Cari nama"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Status Edited
            </label>
            <select
              className="bg-background border-input h-10 rounded-md border px-3 text-sm"
              value={editedFilter}
              onChange={(e) =>
                setEditedFilter(e.target.value as "all" | "true" | "false")
              }
            >
              <option value="all">Semua</option>
              <option value="true">Edited</option>
              <option value="false">Belum Edited</option>
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

        <div className="mt-4 flex flex-wrap gap-3">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Alasan edit"
            className="max-w-md"
          />
          <Button variant="outline" type="button" onClick={triggerWeeklyReport}>
            Generate Report Mingguan
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => loadReports()}
            disabled={reportsStatus === "loading"}
          >
            Refresh Report
          </Button>
        </div>

        {notice ? (
          <div
            className={`mt-3 rounded-md border px-3 py-2 text-sm ${noticeClass(notice.tone)}`}
          >
            {notice.text}
          </div>
        ) : null}
      </section>

      <section className="overflow-x-auto rounded-xl border">
        {isLoadingAttendance && rows.length > 0 ? (
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">
            Memuat data attendance terbaru...
          </div>
        ) : null}
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">Nama Karyawan</th>
              <th className="p-3 text-left">Tanggal</th>
              <th className="p-3 text-left">Jam Datang</th>
              <th className="p-3 text-left">Jam Pulang</th>
              <th className="p-3 text-left">Edited</th>
              <th className="p-3 text-left">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {attendanceStatus === "loading" && rows.length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={6}>
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
                      Coba Lagi
                    </Button>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={6}>
                  {hasAttendanceFilter
                    ? "Tidak ada data attendance yang cocok dengan filter."
                    : "Belum ada data attendance untuk tanggal ini."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row._id} className="border-t">
                  <td className="p-3">{row.employeeName}</td>
                  <td className="p-3">{row.dateKey}</td>
                  <td className="p-3">
                    {row.checkInAt
                      ? new Date(row.checkInAt).toLocaleTimeString("id-ID")
                      : "-"}
                  </td>
                  <td className="p-3">
                    {row.checkOutAt
                      ? new Date(row.checkOutAt).toLocaleTimeString("id-ID")
                      : "-"}
                  </td>
                  <td className="p-3">{row.edited ? "Ya" : "Tidak"}</td>
                  <td className="p-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => editRow(row._id)}
                    >
                      Tandai Edit
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!isLastPage ? (
          <div className="border-t p-3">
            <Button
              type="button"
              variant="outline"
              onClick={loadMoreAttendance}
              disabled={isLoadingAttendance}
            >
              {isLoadingAttendance ? "Memuat..." : "Muat Lagi"}
            </Button>
          </div>
        ) : null}
      </section>

      <section className="overflow-x-auto rounded-xl border">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Riwayat Report Mingguan</h2>
        </div>
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">Week Key</th>
              <th className="p-3 text-left">Range</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Source</th>
              <th className="p-3 text-left">Attempt</th>
              <th className="p-3 text-left">Durasi</th>
              <th className="p-3 text-left">Error</th>
              <th className="p-3 text-left">Generated At</th>
              <th className="p-3 text-left">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {reportsStatus === "loading" && reports.length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={9}>
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
                      Coba Lagi
                    </Button>
                  </div>
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={9}>
                  Belum ada report mingguan.
                </td>
              </tr>
            ) : (
              reports.map((report) => (
                <tr key={report._id} className="border-t">
                  <td className="p-3">{report.weekKey}</td>
                  <td className="p-3">
                    {report.startDate} s/d {report.endDate}
                  </td>
                  <td className="p-3">{report.status}</td>
                  <td className="p-3">{report.triggerSource ?? "-"}</td>
                  <td className="p-3">{report.attempts ?? 1}</td>
                  <td className="p-3">
                    {report.durationMs !== undefined
                      ? `${Math.max(0, Math.round(report.durationMs / 1000))} detik`
                      : "-"}
                  </td>
                  <td className="p-3 max-w-[360px] truncate">
                    {report.status === "failed"
                      ? (report.errorMessage ?? "-")
                      : "-"}
                  </td>
                  <td className="p-3">
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
      </section>
    </div>
  );
}
