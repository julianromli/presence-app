export type WorkspacePanelBusyAction = "none" | "rename" | "rotate" | "delete";

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

export function isWorkspaceMemberActionPending(userId: string, activeUserId: string | null) {
  return userId === activeUserId;
}
