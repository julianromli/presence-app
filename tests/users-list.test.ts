import { describe, expect, it } from "vitest";

import {
  buildUsersMetricsFromRows,
  filterUsers,
  paginateFilteredRows,
  summarizeFromMetrics,
  summarizeUsers,
} from "../convex/usersList";

const rows = [
  {
    _id: "u1",
    name: "Siti Admin",
    email: "siti@acme.test",
    role: "admin",
    isActive: true,
  },
  {
    _id: "u2",
    name: "Budi Karyawan",
    email: "budi@acme.test",
    role: "karyawan",
    isActive: true,
  },
  {
    _id: "u3",
    name: "Andi Device",
    email: "andi@acme.test",
    role: "device-qr",
    isActive: false,
  },
  {
    _id: "u4",
    name: "Rina Karyawan",
    email: "rina@acme.test",
    role: "karyawan",
    isActive: false,
  },
];

describe("users list helpers", () => {
  it("applies filter-first pagination for search results", () => {
    const filtered = filterUsers(rows, {
      q: "rina",
      role: undefined,
      isActive: undefined,
    });
    const firstPage = paginateFilteredRows(filtered, { numItems: 1, cursor: null });

    expect(firstPage.page).toHaveLength(1);
    expect(firstPage.page[0]?.name).toContain("Rina");
  });

  it("traverses full filtered pages deterministically", () => {
    const filtered = filterUsers(rows, {
      q: "acme.test",
      role: "karyawan",
      isActive: undefined,
    });

    const p1 = paginateFilteredRows(filtered, { numItems: 1, cursor: null });
    const p2 = paginateFilteredRows(filtered, { numItems: 1, cursor: p1.continueCursor });

    expect(p1.page[0]?._id).toBe("u2");
    expect(p2.page[0]?._id).toBe("u4");
    expect(p2.isDone).toBe(true);
  });

  it("keeps summary exact for no filter, role, isActive, and q filter", () => {
    const metrics = buildUsersMetricsFromRows(rows, 1000);

    expect(summarizeFromMetrics(metrics, {})).toEqual({
      total: 4,
      active: 2,
      inactive: 2,
    });
    expect(summarizeFromMetrics(metrics, { role: "karyawan" })).toEqual({
      total: 2,
      active: 1,
      inactive: 1,
    });
    expect(summarizeFromMetrics(metrics, { isActive: true })).toEqual({
      total: 2,
      active: 2,
      inactive: 0,
    });

    const qFiltered = filterUsers(rows, {
      q: "andi",
      role: undefined,
      isActive: undefined,
    });
    expect(summarizeUsers(qFiltered)).toEqual({
      total: 1,
      active: 0,
      inactive: 1,
    });
  });
});
