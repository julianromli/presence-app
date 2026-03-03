export type UsersPanelFilters = {
  q: string;
  role: "all" | "superadmin" | "admin" | "karyawan" | "device-qr";
  isActive: "all" | "true" | "false";
};

export const DEFAULT_USERS_FILTERS: UsersPanelFilters = {
  q: "",
  role: "all",
  isActive: "all",
};

export function resolveUsersFilters(
  current: UsersPanelFilters,
  override?: UsersPanelFilters,
) {
  return override ?? current;
}

export function buildUsersQueryString(
  filters: UsersPanelFilters,
  cursor: string | null,
) {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) {
    params.set("cursor", cursor);
  }

  const q = filters.q.trim();
  if (q.length > 0) {
    params.set("q", q);
  }
  if (filters.role !== "all") {
    params.set("role", filters.role);
  }
  if (filters.isActive !== "all") {
    params.set("isActive", filters.isActive);
  }

  return params.toString();
}
