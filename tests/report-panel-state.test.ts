import { describe, expect, it } from "vitest";

import {
  type ReportToolbarAction,
  resolveReportToolbarLoadingState,
} from "../components/dashboard/report-panel-state";

describe("report panel state", () => {
  it("keeps independent toolbar actions loading when they overlap", () => {
    const pendingActions = new Set<ReportToolbarAction>([
      "trigger-weekly",
      "refresh-device",
    ]);

    expect(resolveReportToolbarLoadingState(pendingActions)).toEqual({
      loadMoreAttendance: false,
      refreshAttendance: false,
      refreshDevice: true,
      refreshReports: false,
      refreshScanEvents: false,
      retryAttendance: false,
      retryReports: false,
      submitAttendance: false,
      triggerWeekly: true,
    });
  });

  it("keeps retry actions scoped to their own request", () => {
    const pendingActions = new Set<ReportToolbarAction>([
      "retry-attendance",
      "refresh-reports",
    ]);

    expect(resolveReportToolbarLoadingState(pendingActions)).toEqual({
      loadMoreAttendance: false,
      refreshAttendance: false,
      refreshDevice: false,
      refreshReports: true,
      refreshScanEvents: false,
      retryAttendance: true,
      retryReports: false,
      submitAttendance: false,
      triggerWeekly: false,
    });
  });
});
