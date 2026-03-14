export type WorkspacePanelBusyAction = "none" | "rename" | "rotate" | "delete";
export type WorkspaceMemberPendingState = Partial<Record<string, number>>;

export function isWorkspaceMutationBusy(busyAction: WorkspacePanelBusyAction) {
  return busyAction !== "none";
}

export function canStartWorkspaceMutation(busyAction: WorkspacePanelBusyAction) {
  return !isWorkspaceMutationBusy(busyAction);
}

export function buildWorkspaceDeleteConfirmation(workspaceName: string) {
  return {
    title: "Hapus workspace ini?",
    description: `Workspace "${workspaceName}" akan dinonaktifkan dan akses Anda akan ditutup.`,
    confirmLabel: "Hapus Workspace",
    cancelLabel: "Batal",
    tone: "destructive" as const,
  };
}

export function resolveWorkspaceButtonLoadingState({
  busyAction,
  savingSchedule,
}: {
  busyAction: WorkspacePanelBusyAction;
  savingSchedule: boolean;
}) {
  return {
    deleteWorkspace: busyAction === "delete",
    renameWorkspace: busyAction === "rename",
    rotateInviteCode: busyAction === "rotate",
    saveSchedule: savingSchedule,
  };
}

export function startWorkspaceMemberAction(
  pendingState: WorkspaceMemberPendingState,
  userId: string,
) {
  return {
    ...pendingState,
    [userId]: (pendingState[userId] ?? 0) + 1,
  };
}

export function finishWorkspaceMemberAction(
  pendingState: WorkspaceMemberPendingState,
  userId: string,
) {
  const nextCount = (pendingState[userId] ?? 0) - 1;
  if (nextCount > 0) {
    return {
      ...pendingState,
      [userId]: nextCount,
    };
  }

  const nextState = { ...pendingState };
  delete nextState[userId];
  return nextState;
}

export function isWorkspaceMemberActionPending(
  userId: string,
  pendingState: WorkspaceMemberPendingState,
) {
  return (pendingState[userId] ?? 0) > 0;
}
