import { describe, expect, it } from "vitest";

import {
  finishReportToolbarAction,
  isReportToolbarActionPending,
  startReportToolbarAction,
  type ReportToolbarPendingState,
} from "../components/dashboard/report-panel-state";

describe("report panel state", () => {
  it("keeps overlapping toolbar actions pending independently", () => {
    let pendingState: ReportToolbarPendingState = {};

    pendingState = startReportToolbarAction(pendingState, "trigger-weekly");
    pendingState = startReportToolbarAction(pendingState, "refresh-device");

    expect(isReportToolbarActionPending(pendingState, "trigger-weekly")).toBe(
      true,
    );
    expect(isReportToolbarActionPending(pendingState, "refresh-device")).toBe(
      true,
    );

    pendingState = finishReportToolbarAction(pendingState, "trigger-weekly");

    expect(isReportToolbarActionPending(pendingState, "trigger-weekly")).toBe(
      false,
    );
    expect(isReportToolbarActionPending(pendingState, "refresh-device")).toBe(
      true,
    );
  });

  it("tracks repeated starts for the same toolbar action until every request finishes", () => {
    let pendingState: ReportToolbarPendingState = {};

    pendingState = startReportToolbarAction(
      pendingState,
      "refresh-attendance",
    );
    pendingState = startReportToolbarAction(
      pendingState,
      "refresh-attendance",
    );

    pendingState = finishReportToolbarAction(
      pendingState,
      "refresh-attendance",
    );
    expect(
      isReportToolbarActionPending(pendingState, "refresh-attendance"),
    ).toBe(true);

    pendingState = finishReportToolbarAction(
      pendingState,
      "refresh-attendance",
    );
    expect(
      isReportToolbarActionPending(pendingState, "refresh-attendance"),
    ).toBe(false);
  });
});
