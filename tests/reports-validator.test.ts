import { describe, expect, it } from "vitest";

import { weeklyReportValidator } from "../convex/reports";

describe("weeklyReportValidator", () => {
  it("allows workspace-scoped report rows returned from Convex", () => {
    expect(weeklyReportValidator.json).toMatchObject({
      type: "object",
      value: {
        workspaceId: {
          fieldType: {
            type: "id",
            tableName: "workspaces",
          },
          optional: true,
        },
      },
    });
  });
});
