"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AttendanceWorkspaceFilters } from "@/components/dashboard/attendance-workspace-filters";
import { AttendanceWorkspaceHeader } from "@/components/dashboard/attendance-workspace-header";
import { AttendanceWorkspaceTable } from "@/components/dashboard/attendance-workspace-table";
import { EmployeeQuickList } from "@/components/dashboard/employee-quick-list";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { parseApiErrorResponse } from "@/lib/client-error";
import type { ApiErrorInfo } from "@/lib/client-error";
import {
  createAttendanceEditDraft,
  createEmptyAttendanceEditDraft,
  type AttendanceEditDraft,
  validateAttendanceEditDraft,
} from "@/lib/attendance-edit";
import {
  buildAttendanceQueryString,
  createDefaultAttendanceFilters,
  resolveAttendanceFilters,
  type AttendanceFilters,
} from "@/lib/attendance-filters";
import { filterAttendanceRowsByStatus } from "@/lib/attendance-status";
import {
  recoverWorkspaceScopeViolation,
  workspaceFetch,
} from "@/lib/workspace-client";
import type {
  AdminAttendancePage,
  AdminAttendanceRow,
  AdminUserRow,
} from "@/types/dashboard";

type PanelStatus = "idle" | "loading" | "success" | "empty" | "error";
type NoticeTone = "info" | "success" | "warning" | "error";

type InlineNotice = {
  tone: NoticeTone;
  text: string;
};

type EmployeeQuickListRow = Pick<
  AdminUserRow,
  "_id" | "name" | "email" | "role" | "isActive"
>;
type AttendanceApiPage = {
  rows: AdminAttendanceRow[];
  pageInfo: {
    continueCursor: string;
    isDone: boolean;
    splitCursor?: string | null;
    pageStatus?: "SplitRecommended" | "SplitRequired" | null;
  };
  summary: AdminAttendancePage["summary"];
};

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

type UsersPanelProps = {
  viewerRole: "admin" | "superadmin";
  readOnly?: boolean;
};

export function UsersPanel({ viewerRole, readOnly = false }: UsersPanelProps) {
  const searchParams = useSearchParams();
  const headerQuery = (searchParams.get("q") ?? "").trim();
  const initialFilters = useMemo<AttendanceFilters>(
    () =>
      resolveAttendanceFilters({
        ...createDefaultAttendanceFilters(),
        q: headerQuery,
      }),
    [headerQuery],
  );

  const [filters, setFilters] = useState<AttendanceFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<AttendanceFilters>(initialFilters);
  const [attendanceRows, setAttendanceRows] = useState<AdminAttendanceRow[]>(
    [],
  );
  const [attendanceSummary, setAttendanceSummary] = useState<
    AdminAttendancePage["summary"]
  >({
    total: 0,
    checkedIn: 0,
    checkedOut: 0,
    edited: 0,
  });
  const [employeeRows, setEmployeeRows] = useState<EmployeeQuickListRow[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<PanelStatus>("idle");
  const [employeeStatus, setEmployeeStatus] = useState<PanelStatus>("idle");
  const [attendanceError, setAttendanceError] = useState<ApiErrorInfo | null>(
    null,
  );
  const [employeeError, setEmployeeError] = useState<ApiErrorInfo | null>(null);
  const [attendanceNotice, setAttendanceNotice] = useState<InlineNotice | null>(
    null,
  );
  const [attendanceCursor, setAttendanceCursor] = useState<string | null>(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [isEmployeeLoading, setIsEmployeeLoading] = useState(false);
  const [filtersAction, setFiltersAction] = useState<
    "submit" | "refresh" | "reset" | null
  >(null);
  const [editDraft, setEditDraft] = useState<AttendanceEditDraft>(
    createEmptyAttendanceEditDraft(),
  );
  const [confirmSaveAttendanceRow, setConfirmSaveAttendanceRow] =
    useState<AdminAttendanceRow | null>(null);
  const [rowActionAttendanceId, setRowActionAttendanceId] = useState<
    string | null
  >(null);
  const hasLoadedInitial = useRef(false);
  const prevHeaderQueryRef = useRef(headerQuery);

  const filteredAttendanceRows = useMemo(() => {
    return filterAttendanceRowsByStatus(attendanceRows, appliedFilters.status);
  }, [appliedFilters.status, attendanceRows]);

  const hasAttendanceFilters = useMemo(
    () =>
      appliedFilters.q.trim().length > 0 ||
      appliedFilters.status !== "all" ||
      appliedFilters.edited !== "all",
    [appliedFilters],
  );

  const loadAttendance = useCallback(
    async (
      options: {
        append?: boolean;
        cursor?: string | null;
        activeFilters?: AttendanceFilters;
      } = {},
    ) => {
      const append = options.append ?? false;
      const cursor = options.cursor ?? null;
      const activeFilters = resolveAttendanceFilters(
        options.activeFilters ?? appliedFilters,
      );

      if (!append) {
        setAttendanceStatus("loading");
        setAttendanceError(null);
      }
      setIsAttendanceLoading(true);

      const response = await workspaceFetch(
        `/api/admin/attendance?${buildAttendanceQueryString(activeFilters, cursor)}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        const parsed = await parseApiErrorResponse(
          response,
          "Gagal memuat attendance harian.",
        );
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          setIsAttendanceLoading(false);
          return;
        }

        setAttendanceError(parsed);
        setAttendanceStatus("error");
        setIsAttendanceLoading(false);
        return;
      }

      const payload = (await response.json()) as AttendanceApiPage;
      setAttendanceRows((current) =>
        append ? [...current, ...payload.rows] : payload.rows,
      );
      setAttendanceSummary(payload.summary);
      setAttendanceCursor(
        payload.pageInfo.isDone ? null : payload.pageInfo.continueCursor,
      );
      setAttendanceStatus(
        payload.rows.length === 0 && !append ? "empty" : "success",
      );
      setIsAttendanceLoading(false);
    },
    [appliedFilters],
  );

  const loadEmployees = useCallback(
    async (activeFilters: AttendanceFilters = appliedFilters) => {
      setEmployeeStatus("loading");
      setEmployeeError(null);
      setIsEmployeeLoading(true);

      const params = new URLSearchParams({
        limit: "12",
        role: "karyawan",
      });
      const q = activeFilters.q.trim();
      if (q.length > 0) {
        params.set("q", q);
      }

      const response = await workspaceFetch(
        `/api/admin/users?${params.toString()}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const parsed = await parseApiErrorResponse(
          response,
          "Gagal memuat daftar karyawan.",
        );
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          setIsEmployeeLoading(false);
          return;
        }

        setEmployeeRows([]);
        setEmployeeError(parsed);
        setEmployeeStatus("error");
        setIsEmployeeLoading(false);
        return;
      }

      const payload = (await response.json()) as {
        rows: EmployeeQuickListRow[];
      };
      setEmployeeRows(payload.rows);
      setEmployeeStatus(payload.rows.length === 0 ? "empty" : "success");
      setIsEmployeeLoading(false);
    },
    [appliedFilters],
  );

  const refreshWorkspaceSections = useCallback(
    async (activeFilters: AttendanceFilters = appliedFilters) => {
      await Promise.all([
        loadAttendance({ activeFilters }),
        loadEmployees(activeFilters),
      ]);
    },
    [appliedFilters, loadAttendance, loadEmployees],
  );

  useEffect(() => {
    if (hasLoadedInitial.current) return;
    hasLoadedInitial.current = true;

    const frameId = requestAnimationFrame(() => {
      void refreshWorkspaceSections(initialFilters);
    });

    return () => cancelAnimationFrame(frameId);
  }, [initialFilters, refreshWorkspaceSections]);

  useEffect(() => {
    if (prevHeaderQueryRef.current === headerQuery) return;
    prevHeaderQueryRef.current = headerQuery;

    const nextFilters = resolveAttendanceFilters({
      ...appliedFilters,
      q: headerQuery,
    });

    const frameId = requestAnimationFrame(() => {
      setFilters(nextFilters);
      setAppliedFilters(nextFilters);
      void refreshWorkspaceSections(nextFilters);
    });

    return () => cancelAnimationFrame(frameId);
  }, [appliedFilters, headerQuery, refreshWorkspaceSections]);

  useEffect(() => {
    const handleRefresh = () => {
      void refreshWorkspaceSections(appliedFilters);
    };

    window.addEventListener(
      "dashboard:refresh",
      handleRefresh as EventListener,
    );
    return () => {
      window.removeEventListener(
        "dashboard:refresh",
        handleRefresh as EventListener,
      );
    };
  }, [appliedFilters, refreshWorkspaceSections]);

  const applyFilters = async (nextFilters: AttendanceFilters) => {
    const resolved = resolveAttendanceFilters(nextFilters);
    setFilters(resolved);
    setAppliedFilters(resolved);
    await refreshWorkspaceSections(resolved);
  };

  const requestSaveAttendance = (row: AdminAttendanceRow) => {
    const validation = validateAttendanceEditDraft(row.dateKey, editDraft);
    if (!validation.ok) {
      setAttendanceNotice({
        tone: "warning",
        text: `[${validation.code}] ${validation.message}`,
      });
      return;
    }

    setConfirmSaveAttendanceRow(row);
  };

  const handleConfirmSave = async () => {
    if (!confirmSaveAttendanceRow) {
      return;
    }

    const validation = validateAttendanceEditDraft(
      confirmSaveAttendanceRow.dateKey,
      editDraft,
    );
    if (!validation.ok) {
      setAttendanceNotice({
        tone: "warning",
        text: `[${validation.code}] ${validation.message}`,
      });
      setConfirmSaveAttendanceRow(null);
      return;
    }

    setRowActionAttendanceId(confirmSaveAttendanceRow._id);
    try {
      const response = await workspaceFetch("/api/admin/attendance/edit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.payload),
      });

      if (!response.ok) {
        const parsed = await parseApiErrorResponse(
          response,
          "Edit attendance gagal.",
        );
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          return;
        }

        setAttendanceNotice({
          tone: "error",
          text: `[${parsed.code}] ${parsed.message}`,
        });
        return;
      }

      setAttendanceNotice({
        tone: "success",
        text: "Edit attendance tersimpan dan attendance table sudah diperbarui.",
      });
      setEditDraft(createEmptyAttendanceEditDraft());
      await loadAttendance({ activeFilters: appliedFilters });
    } finally {
      setConfirmSaveAttendanceRow(null);
      setRowActionAttendanceId(null);
    }
  };

  return (
    <div className="animate-in space-y-6 pb-20 fade-in duration-500 md:space-y-7">
      <ConfirmationDialog
        open={Boolean(confirmSaveAttendanceRow)}
        title="Simpan koreksi attendance ini?"
        description={
          confirmSaveAttendanceRow
            ? `Perubahan jam attendance untuk ${confirmSaveAttendanceRow.employeeName} pada ${confirmSaveAttendanceRow.dateKey} akan masuk ke audit log.`
            : ""
        }
        confirmLabel="Simpan"
        cancelLabel="Batal"
        isPending={
          confirmSaveAttendanceRow
            ? rowActionAttendanceId === confirmSaveAttendanceRow._id
            : false
        }
        onConfirm={() => {
          void handleConfirmSave();
        }}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmSaveAttendanceRow(null);
          }
        }}
      />

      <div className="space-y-4 md:space-y-5">
        <AttendanceWorkspaceHeader
          viewerRole={viewerRole}
          readOnly={readOnly}
          summary={attendanceSummary}
        />

        <AttendanceWorkspaceFilters
          filters={filters}
          isLoading={isAttendanceLoading || isEmployeeLoading}
          pendingAction={filtersAction}
          onSubmit={() => {
            setFiltersAction("submit");
            void applyFilters(filters).finally(() => setFiltersAction(null));
          }}
          onRefresh={() => {
            setFiltersAction("refresh");
            void refreshWorkspaceSections(appliedFilters).finally(() =>
              setFiltersAction(null),
            );
          }}
          onReset={() => {
            setFiltersAction("reset");
            void applyFilters({
              ...createDefaultAttendanceFilters(),
              q: headerQuery,
            }).finally(() => setFiltersAction(null));
          }}
          onChange={(patch) => {
            setFilters((current) =>
              resolveAttendanceFilters({ ...current, ...patch }),
            );
          }}
        />
      </div>

      {attendanceNotice ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${noticeClass(attendanceNotice.tone)}`}
        >
          {attendanceNotice.text}
        </div>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2.35fr)_minmax(300px,0.82fr)] xl:gap-6">
        <AttendanceWorkspaceTable
          rows={filteredAttendanceRows}
          status={attendanceStatus}
          errorMessage={
            attendanceError
              ? `[${attendanceError.code}] ${attendanceError.message}`
              : null
          }
          hasFilters={hasAttendanceFilters}
          isLoading={isAttendanceLoading}
          hasNextPage={Boolean(attendanceCursor)}
          readOnly={readOnly}
          activeDraft={editDraft}
          rowActionAttendanceId={rowActionAttendanceId}
          onStartEdit={(row) => {
            setEditDraft(createAttendanceEditDraft(row));
            setConfirmSaveAttendanceRow(null);
          }}
          onDraftChange={(draft) => {
            setEditDraft(draft);
          }}
          onCancelEdit={() => {
            setEditDraft(createEmptyAttendanceEditDraft());
            setConfirmSaveAttendanceRow(null);
          }}
          onConfirmSave={(row) => {
            requestSaveAttendance(row);
          }}
          onLoadMore={() => {
            void loadAttendance({
              append: true,
              cursor: attendanceCursor,
              activeFilters: appliedFilters,
            });
          }}
        />

        <div className="xl:sticky xl:top-24">
          <EmployeeQuickList
            rows={employeeRows}
            status={employeeStatus}
            errorMessage={
              employeeError
                ? `[${employeeError.code}] ${employeeError.message}`
                : null
            }
            attendanceRows={filteredAttendanceRows}
            onSelectEmployee={(employeeName) => {
              const nextFilters = resolveAttendanceFilters({
                ...filters,
                q: employeeName,
              });
              void applyFilters(nextFilters);
            }}
          />
        </div>
      </div>
    </div>
  );
}
