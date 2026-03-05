import { beforeEach, describe, expect, it, vi } from "vitest";

const setActiveWorkspaceIdInBrowser = vi.fn();

vi.mock("@/lib/workspace-client", () => ({
  setActiveWorkspaceIdInBrowser,
}));

describe("onboarding workspace bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets active workspace before redirect continuation when membership exists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ activeWorkspaceId: "workspace_123456" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const { bootstrapActiveWorkspaceForMember } = await import(
      "../app/onboarding/workspace/bootstrap-active-workspace"
    );
    const workspaceId = await bootstrapActiveWorkspaceForMember(fetchMock);

    expect(workspaceId).toBe("workspace_123456");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/workspaces/memberships",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/workspaces/active",
      expect.objectContaining({ method: "POST" }),
    );
    expect(setActiveWorkspaceIdInBrowser).toHaveBeenCalledWith("workspace_123456");
  });

  it("returns null when no active workspace id is available", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ activeWorkspaceId: null }), { status: 200 }),
    );

    const { bootstrapActiveWorkspaceForMember } = await import(
      "../app/onboarding/workspace/bootstrap-active-workspace"
    );
    const workspaceId = await bootstrapActiveWorkspaceForMember(fetchMock);

    expect(workspaceId).toBeNull();
    expect(setActiveWorkspaceIdInBrowser).not.toHaveBeenCalled();
  });
});
