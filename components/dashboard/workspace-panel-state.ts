export type WorkspacePanelBusyAction = "rename" | "rotate" | "delete";

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
  busyActions,
  savingSchedule,
}: {
  busyActions: ReadonlySet<WorkspacePanelBusyAction>;
  savingSchedule: boolean;
}) {
  return {
    deleteWorkspace: busyActions.has("delete"),
    renameWorkspace: busyActions.has("rename"),
    rotateInviteCode: busyActions.has("rotate"),
    saveSchedule: savingSchedule,
  };
}

export function isWorkspaceMemberActionPending(
  userId: string,
  pendingUserIds: ReadonlySet<string>,
) {
  return pendingUserIds.has(userId);
}
