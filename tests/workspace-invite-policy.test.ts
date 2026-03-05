import { describe, expect, it } from "vitest";

import { listActiveInviteCodeIds } from "../convex/workspaceInvitePolicy";

describe("workspace invite policy", () => {
  it("returns only active invite code ids", () => {
    const ids = listActiveInviteCodeIds([
      { _id: "code_1", isActive: true },
      { _id: "code_2", isActive: false },
      { _id: "code_3", isActive: true },
    ]);

    expect(ids).toEqual(["code_1", "code_3"]);
  });

  it("returns empty array when no active invite code exists", () => {
    const ids = listActiveInviteCodeIds([
      { _id: "code_1", isActive: false },
      { _id: "code_2", isActive: false },
    ]);

    expect(ids).toEqual([]);
  });
});
