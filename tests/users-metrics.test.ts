import { describe, expect, it } from "vitest";

import {
  buildGlobalUsersMetricsSnapshot,
  isGlobalUsersMetricsRow,
  pickCanonicalUsersMetricsRow,
} from "../convex/usersMetrics";

describe("users metrics helpers", () => {
  it("filters only the legacy global metrics row shape", () => {
    expect(isGlobalUsersMetricsRow({ key: "global", workspaceId: undefined })).toBe(true);
    expect(isGlobalUsersMetricsRow({ key: "global", workspaceId: "workspace_123" })).toBe(false);
    expect(isGlobalUsersMetricsRow({ key: "other", workspaceId: undefined })).toBe(false);
  });

  it("picks the newest global row deterministically", () => {
    const row = pickCanonicalUsersMetricsRow([
      { _id: "m1", updatedAt: 10 },
      { _id: "m2", updatedAt: 20 },
      { _id: "m3", updatedAt: 20 },
    ]);

    expect(row?._id).toBe("m2");
  });

  it("builds a global snapshot without workspace scope", () => {
    const snapshot = buildGlobalUsersMetricsSnapshot(
      [
        { role: "admin", isActive: true },
        { role: "karyawan", isActive: false },
      ],
      1234,
    );

    expect(snapshot).toMatchObject({
      key: "global",
      workspaceId: undefined,
      total: 2,
      active: 1,
      inactive: 1,
      updatedAt: 1234,
    });
  });
});
