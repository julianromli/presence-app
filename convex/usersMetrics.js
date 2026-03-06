import { buildUsersMetricsFromRows } from "./usersList";

export function isGlobalUsersMetricsRow(row) {
  return row?.key === "global" && row?.workspaceId === undefined;
}

export function pickCanonicalUsersMetricsRow(rows) {
  if (!rows.length) {
    return null;
  }

  return [...rows].sort((left, right) => {
    if ((right.updatedAt ?? 0) !== (left.updatedAt ?? 0)) {
      return (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
    }
    return String(left._id).localeCompare(String(right._id));
  })[0];
}

export function buildGlobalUsersMetricsSnapshot(users, now = Date.now()) {
  return {
    ...buildUsersMetricsFromRows(users, now),
    workspaceId: undefined,
  };
}
export async function listGlobalUsersMetricsRows(ctx) {
  const rows = await ctx.db
    .query("users_metrics")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .collect();

  return rows.filter(isGlobalUsersMetricsRow);
}
