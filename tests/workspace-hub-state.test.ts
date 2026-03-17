import { describe, expect, it } from "vitest";

import {
  buildWorkspaceMutationNotice,
  resolveActiveWorkspaceName,
  type WorkspaceHubMembership,
} from "../components/dashboard/workspace-hub-state";

const memberships: WorkspaceHubMembership[] = [
  {
    workspace: {
      _id: "workspace_123456",
      name: "Lumbung Tour Haramain",
      slug: "lumbung-tour-haramain",
    },
    role: "admin",
  },
];

describe("workspace hub state", () => {
  it("uses the optimistic workspace name while memberships are stale", () => {
    expect(
      resolveActiveWorkspaceName({
        memberships,
        activeWorkspaceId: "workspace_new",
        loading: false,
        optimisticActiveWorkspaceName: "Presence Ops",
      }),
    ).toBe("Presence Ops");
  });

  it("falls back to loading and empty labels when no active workspace can be resolved", () => {
    expect(
      resolveActiveWorkspaceName({
        memberships: [],
        activeWorkspaceId: null,
        loading: true,
        optimisticActiveWorkspaceName: null,
      }),
    ).toBe("Memuat...");

    expect(
      resolveActiveWorkspaceName({
        memberships: [],
        activeWorkspaceId: null,
        loading: false,
        optimisticActiveWorkspaceName: null,
      }),
    ).toBe("Tidak ada workspace");
  });

  it("downgrades the notice when workspace activation succeeds but membership refresh fails", () => {
    expect(
      buildWorkspaceMutationNotice({
        refreshSucceeded: false,
        successText: "Workspace baru berhasil dibuat dan langsung dipilih.",
        refreshFailureText:
          "Workspace baru berhasil dipilih, tapi daftar workspace belum terbarui.",
      }),
    ).toEqual({
      tone: "info",
      text: "Workspace baru berhasil dipilih, tapi daftar workspace belum terbarui.",
    });
  });
});
