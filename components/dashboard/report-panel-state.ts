export type ReportToolbarAction =
  | "submit-attendance"
  | "refresh-attendance"
  | "trigger-weekly"
  | "refresh-reports"
  | "refresh-scan-events"
  | "refresh-device"
  | "load-more-attendance"
  | "retry-attendance"
  | "retry-reports";

export function resolveReportToolbarLoadingState(
  pendingActions: ReadonlySet<ReportToolbarAction>,
) {
  return {
    loadMoreAttendance: pendingActions.has("load-more-attendance"),
    refreshAttendance: pendingActions.has("refresh-attendance"),
    refreshDevice: pendingActions.has("refresh-device"),
    refreshReports: pendingActions.has("refresh-reports"),
    refreshScanEvents: pendingActions.has("refresh-scan-events"),
    retryAttendance: pendingActions.has("retry-attendance"),
    retryReports: pendingActions.has("retry-reports"),
    submitAttendance: pendingActions.has("submit-attendance"),
    triggerWeekly: pendingActions.has("trigger-weekly"),
  };
}
