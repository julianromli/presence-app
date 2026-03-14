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

export type ReportToolbarPendingState = Partial<
  Record<ReportToolbarAction, number>
>;

export function startReportToolbarAction(
  pendingState: ReportToolbarPendingState,
  action: ReportToolbarAction,
): ReportToolbarPendingState {
  return {
    ...pendingState,
    [action]: (pendingState[action] ?? 0) + 1,
  };
}

export function finishReportToolbarAction(
  pendingState: ReportToolbarPendingState,
  action: ReportToolbarAction,
): ReportToolbarPendingState {
  const nextCount = (pendingState[action] ?? 0) - 1;
  if (nextCount > 0) {
    return {
      ...pendingState,
      [action]: nextCount,
    };
  }

  const nextState = { ...pendingState };
  delete nextState[action];
  return nextState;
}

export function isReportToolbarActionPending(
  pendingState: ReportToolbarPendingState,
  action: ReportToolbarAction,
) {
  return (pendingState[action] ?? 0) > 0;
}
