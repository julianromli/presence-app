import { describe, expect, it } from "vitest";

import {
  buildWorkspaceDeleteConfirmation,
  isWorkspaceMemberActionPending,
  resolveWorkspaceButtonLoadingState,
} from "../components/dashboard/workspace-panel-state";

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

  it("keeps member row loading scoped to the active user", () => {
    expect(isWorkspaceMemberActionPending("user_123", "user_123")).toBe(true);
    expect(isWorkspaceMemberActionPending("user_999", "user_123")).toBe(false);
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
