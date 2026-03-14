import { describe, expect, it } from "vitest";

import {
  buildWorkspaceDeleteConfirmation,
  isWorkspaceMemberActionPending,
  resolveWorkspaceButtonLoadingState,
} from "../components/dashboard/workspace-panel-state";

describe("workspace panel state", () => {
  it("keeps multiple top-level actions loading when they overlap", () => {
    expect(
      resolveWorkspaceButtonLoadingState({
        busyActions: new Set(["rotate", "delete"]),
        savingSchedule: false,
      }),
    ).toEqual({
      deleteWorkspace: true,
      renameWorkspace: false,
      rotateInviteCode: true,
      saveSchedule: false,
    });
  });

  it("marks schedule saving independently from other actions", () => {
    expect(
      resolveWorkspaceButtonLoadingState({
        busyActions: new Set(),
        savingSchedule: true,
      }),
    ).toEqual({
      deleteWorkspace: false,
      renameWorkspace: false,
      rotateInviteCode: false,
      saveSchedule: true,
    });
  });

  it("keeps member row loading scoped to every user still pending", () => {
    const pendingUserIds = new Set(["user_123", "user_999"]);

    expect(isWorkspaceMemberActionPending("user_123", pendingUserIds)).toBe(true);
    expect(isWorkspaceMemberActionPending("user_999", pendingUserIds)).toBe(true);
    expect(isWorkspaceMemberActionPending("user_456", pendingUserIds)).toBe(false);
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
