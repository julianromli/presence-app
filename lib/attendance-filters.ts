import { getLocalDateKey } from "./date-key";

export type AttendanceStatusFilter =
  | "all"
  | "not-checked-in"
  | "checked-in"
  | "incomplete"
  | "completed";

export type AttendanceEditedFilter = "all" | "true" | "false";

export type AttendanceFilters = {
  dateKey: string;
  q: string;
  status: AttendanceStatusFilter;
  edited: AttendanceEditedFilter;
};

export const DEFAULT_ATTENDANCE_FILTERS: AttendanceFilters = {
  dateKey: getLocalDateKey(),
  q: "",
  status: "all",
  edited: "all",
};

export const ATTENDANCE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Semua" },
  { value: "not-checked-in", label: "Belum check-in" },
  { value: "checked-in", label: "Sudah check-in" },
  { value: "incomplete", label: "Belum check-out" },
  { value: "completed", label: "Lengkap" },
] as const satisfies ReadonlyArray<{
  value: AttendanceStatusFilter;
  label: string;
}>;

export const ATTENDANCE_EDITED_FILTER_OPTIONS = [
  { value: "all", label: "Semua" },
  { value: "true", label: "Edited" },
  { value: "false", label: "Original" },
] as const satisfies ReadonlyArray<{
  value: AttendanceEditedFilter;
  label: string;
}>;

const STATUS_FILTERS = new Set<AttendanceStatusFilter>([
  "all",
  "not-checked-in",
  "checked-in",
  "incomplete",
  "completed",
]);

const EDITED_FILTERS = new Set<AttendanceEditedFilter>(["all", "true", "false"]);

export function getAttendanceStatusFilterLabel(value: AttendanceStatusFilter) {
  return (
    ATTENDANCE_STATUS_FILTER_OPTIONS.find((option) => option.value === value)?.label ?? "Semua"
  );
}

export function getAttendanceEditedFilterLabel(value: AttendanceEditedFilter) {
  return (
    ATTENDANCE_EDITED_FILTER_OPTIONS.find((option) => option.value === value)?.label ?? "Semua"
  );
}

export function resolveAttendanceFilters(
  input?: Partial<AttendanceFilters>,
  defaults: AttendanceFilters = DEFAULT_ATTENDANCE_FILTERS,
): AttendanceFilters {
  const nextDateKey = input?.dateKey?.trim() || defaults.dateKey;
  const nextQuery = input?.q?.trim() ?? defaults.q;
  const nextStatus = STATUS_FILTERS.has(input?.status as AttendanceStatusFilter)
    ? (input?.status as AttendanceStatusFilter)
    : defaults.status;
  const nextEdited = EDITED_FILTERS.has(input?.edited as AttendanceEditedFilter)
    ? (input?.edited as AttendanceEditedFilter)
    : defaults.edited;

  return {
    dateKey: nextDateKey,
    q: nextQuery,
    status: nextStatus,
    edited: nextEdited,
  };
}

export function serializeAttendanceFilters(input?: Partial<AttendanceFilters>) {
  const filters = resolveAttendanceFilters(input);
  const params = new URLSearchParams({
    dateKey: filters.dateKey,
  });

  if (filters.q.length > 0) {
    params.set("q", filters.q);
  }
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.edited !== "all") {
    params.set("edited", filters.edited);
  }

  return params.toString();
}

export function buildAttendanceQueryString(
  input: Partial<AttendanceFilters> | undefined,
  cursor: string | null,
) {
  const filters = resolveAttendanceFilters(input);
  const params = new URLSearchParams({
    dateKey: filters.dateKey,
    limit: "20",
  });

  if (cursor) {
    params.set("cursor", cursor);
  }
  if (filters.q.length > 0) {
    params.set("q", filters.q);
  }
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.edited !== "all") {
    params.set("edited", filters.edited);
  }

  return params.toString();
}
