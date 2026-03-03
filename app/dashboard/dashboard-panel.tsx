"use client";

import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

export function DashboardPanel() {
  const [dateKey, setDateKey] = useState(() => todayDateKey());
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
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("Koreksi admin");
  const [reportStatus, setReportStatus] = useState("");
  const [reports, setReports] = useState<WeeklyReportRow[]>([]);

  const buildAttendanceParams = (cursor: string | null) => {
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
  };

  const loadAttendance = async (
    opts: LoadAttendanceOptions = { append: false, cursor: null },
  ) => {
    setIsLoadingAttendance(true);

    const res = await fetch(
      `/api/admin/attendance?${buildAttendanceParams(opts.cursor)}`,
      {
        cache: "no-store",
      },
    );

    if (!res.ok) {
      setMessage("Gagal memuat data absensi.");
      setIsLoadingAttendance(false);
      return;
    }

    const data = (await res.json()) as AttendanceListResponse;
    setRows((prev) => (opts.append ? [...prev, ...data.rows] : data.rows));
    setSummary(data.summary);
    setNextCursor(data.pageInfo.isDone ? null : data.pageInfo.continueCursor);
    setIsLastPage(data.pageInfo.isDone);
    setMessage(
      `Data ${dateKey} dimuat (${data.rows.length} baris ${opts.append ? "tambahan" : "halaman awal"}).`,
    );
    setIsLoadingAttendance(false);
  };

  const loadMoreAttendance = async () => {
    if (!nextCursor || isLastPage || isLoadingAttendance) {
      return;
    }
    await loadAttendance({ append: true, cursor: nextCursor });
  };

  const triggerWeeklyReport = async () => {
    setReportStatus("Memproses report...");
    const res = await fetch("/api/admin/reports", { method: "POST" });
    const data = (await res.json()) as WeeklyTriggerResponse;
    if (data.skipped) {
      setReportStatus(
        `Report ${data.weekKey ?? "-"} dilewati (status existing: ${data.status ?? "unknown"}).`,
      );
    } else {
      setReportStatus(
        `Report ${data.weekKey ?? "-"} status: ${data.status ?? "unknown"}`,
      );
    }
    await loadReports();
  };

  const loadReports = async () => {
    const res = await fetch("/api/admin/reports", { cache: "no-store" });
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as WeeklyReportRow[];
    setReports(data);
  };

  const downloadReport = (reportId: string) => {
    window.location.assign(
      `/api/admin/reports/download?reportId=${encodeURIComponent(reportId)}`,
    );
  };

  const editRow = async (attendanceId: string) => {
    const res = await fetch("/api/admin/attendance/edit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceId, reason }),
    });

    if (res.ok) {
      setMessage("Edit attendance tersimpan dan masuk audit log.");
      await loadAttendance({ append: false, cursor: null });
      return;
    }

    setMessage("Edit attendance gagal.");
  };

  const submitDate = async (e: FormEvent) => {
    e.preventDefault();
    await loadAttendance({ append: false, cursor: null });
  };

  useEffect(() => {
    void loadReports();
  }, []);

  useEffect(() => {
    if (!reports.some((report) => report.status === "pending")) {
      return;
    }

    const interval = setInterval(() => {
      void loadReports();
    }, 12_000);

    return () => clearInterval(interval);
  }, [reports]);

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
        </div>

        {reportStatus ? <p className="mt-3 text-sm">{reportStatus}</p> : null}
        {message ? <p className="mt-2 text-sm">{message}</p> : null}
      </section>

      <section className="overflow-x-auto rounded-xl border">
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
            {rows.map((row) => (
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
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={6}>
                  Belum ada data. Pilih tanggal lalu klik Muat Data.
                </td>
              </tr>
            ) : null}
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
              <th className="p-3 text-left">Error</th>
              <th className="p-3 text-left">Generated At</th>
              <th className="p-3 text-left">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report._id} className="border-t">
                <td className="p-3">{report.weekKey}</td>
                <td className="p-3">
                  {report.startDate} s/d {report.endDate}
                </td>
                <td className="p-3">{report.status}</td>
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
            ))}
            {reports.length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={6}>
                  Belum ada report mingguan.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
