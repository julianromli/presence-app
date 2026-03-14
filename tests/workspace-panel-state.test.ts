import { describe, expect, it } from "vitest";

import {
  buildWorkspaceDeleteConfirmation,
  canStartWorkspaceMutation,
  finishWorkspaceMemberAction,
  beginWorkspacePanelRefresh,
  isWorkspaceMemberActionPending,
  isWorkspaceMutationBusy,
  isLatestWorkspacePanelRefresh,
  type WorkspacePanelRefreshState,
  resolveWorkspaceButtonLoadingState,
  startWorkspaceMemberAction,
  type WorkspaceMemberPendingState,
} from "@/components/dashboard/workspace-panel-state";

describe("workspace panel state", () => {
  it("marks only the active top-level action as loading", () => {
    expect(
      resolveWorkspaceButtonLoadingState({
        busyAction: "rotate",
        savingSchedule: false,
      }),
    ).toEqual({
      deleteWorkspace: false,
      renameWorkspace: false,
      rotateInviteCode: true,
      saveSchedule: false,
    });
  });

  it("marks schedule saving independently from other actions", () => {
    expect(
      resolveWorkspaceButtonLoadingState({
        busyAction: "none",
        savingSchedule: true,
      }),
    ).toEqual({
      deleteWorkspace: false,
      renameWorkspace: false,
      rotateInviteCode: false,
      saveSchedule: true,
    });
  });

  it("treats any active workspace mutation as a global lock", () => {
    expect(isWorkspaceMutationBusy("rename")).toBe(true);
    expect(isWorkspaceMutationBusy("rotate")).toBe(true);
    expect(isWorkspaceMutationBusy("delete")).toBe(true);
    expect(isWorkspaceMutationBusy("none")).toBe(false);
    expect(canStartWorkspaceMutation("none")).toBe(true);
    expect(canStartWorkspaceMutation("rename")).toBe(false);
  });

  it("keeps member row loading scoped to the active user", () => {
    let pendingState: WorkspaceMemberPendingState = {};
    pendingState = startWorkspaceMemberAction(pendingState, "user_123");
    pendingState = startWorkspaceMemberAction(pendingState, "user_999");

    expect(isWorkspaceMemberActionPending("user_123", pendingState)).toBe(true);
    expect(isWorkspaceMemberActionPending("user_999", pendingState)).toBe(true);

    pendingState = finishWorkspaceMemberAction(pendingState, "user_123");

    expect(isWorkspaceMemberActionPending("user_123", pendingState)).toBe(false);
    expect(isWorkspaceMemberActionPending("user_999", pendingState)).toBe(true);
  });

  it("only treats the newest refresh request as writable", () => {
    let refreshState: WorkspacePanelRefreshState = {
      members: 0,
      workspaceData: 0,
    };

    const firstMembersRefresh = beginWorkspacePanelRefresh(refreshState, "members");
    refreshState = firstMembersRefresh.nextState;

    const secondMembersRefresh = beginWorkspacePanelRefresh(refreshState, "members");
    refreshState = secondMembersRefresh.nextState;

    expect(
      isLatestWorkspacePanelRefresh(refreshState, "members", firstMembersRefresh.requestId),
    ).toBe(false);
    expect(
      isLatestWorkspacePanelRefresh(refreshState, "members", secondMembersRefresh.requestId),
    ).toBe(true);
    expect(
      isLatestWorkspacePanelRefresh(refreshState, "workspaceData", 0),
    ).toBe(true);
  });

  it("builds destructive confirmation copy for workspace deletion", () => {
    expect(buildWorkspaceDeleteConfirmation("Presence Ops")).toEqual({
      cancelLabel: "Batal",
      confirmLabel: "Hapus Workspace",
      description:
        'Workspace "Presence Ops" akan dinonaktifkan dan akses Anda akan ditutup.',
      title: "Hapus workspace ini?",
      tone: "destructive",
    });
  });
});
