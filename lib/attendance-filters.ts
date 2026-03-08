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

const STATUS_FILTERS = new Set<AttendanceStatusFilter>([
  "all",
  "not-checked-in",
  "checked-in",
  "incomplete",
  "completed",
]);

const EDITED_FILTERS = new Set<AttendanceEditedFilter>(["all", "true", "false"]);

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
