import { describe, expect, it } from "vitest";

import {
  buildUsersQueryString,
  DEFAULT_USERS_FILTERS,
  resolveUsersFilters,
} from "../lib/users-filters";

describe("users filters", () => {
  it("prefers override filters to avoid stale reset requests", () => {
    const stale = { q: "budi", role: "admin", isActive: "false" } as const;
    const resolved = resolveUsersFilters(stale, DEFAULT_USERS_FILTERS);

    expect(resolved).toEqual(DEFAULT_USERS_FILTERS);
    expect(buildUsersQueryString(resolved, null)).toBe("limit=20");
  });

  it("builds query params for active filters and cursor", () => {
    const query = buildUsersQueryString(
      {
        q: "  andi  ",
        role: "karyawan",
        isActive: "true",
      },
      "offset:20",
    );

    expect(query).toContain("limit=20");
    expect(query).toContain("cursor=offset%3A20");
    expect(query).toContain("q=andi");
    expect(query).toContain("role=karyawan");
    expect(query).toContain("isActive=true");
  });
});
