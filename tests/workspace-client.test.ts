import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/workspace-context", () => ({
  ACTIVE_WORKSPACE_COOKIE: "active_workspace_id",
}));

function createWindowMock(initialWorkspaceId: string | null) {
  const store = new Map<string, string>();
  if (initialWorkspaceId) {
    store.set("active_workspace_id", initialWorkspaceId);
  }

  const locationAssign = vi.fn();
  const windowMock = {
    location: {
      assign: locationAssign,
    },
    localStorage: {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
      }),
    },
  };

  return { windowMock, locationAssign };
}

describe("workspace-client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("bootstraps the active workspace before the first scoped request when browser state is empty", async () => {
    const { windowMock, locationAssign } = createWindowMock(null);
    vi.stubGlobal("window", windowMock);
    vi.stubGlobal("document", { cookie: "" });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ activeWorkspaceId: "workspace_bootstrap" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { workspaceFetch } = await import("../lib/workspace-client");
    const response = await workspaceFetch("/api/admin/users", { cache: "no-store" });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/workspaces/memberships",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/admin/users",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.any(Headers),
      }),
    );
    const scopedHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Headers;
    expect(scopedHeaders.get("x-workspace-id")).toBe("workspace_bootstrap");
    expect(windowMock.localStorage.setItem).toHaveBeenCalledWith(
      "active_workspace_id",
      "workspace_bootstrap",
    );
    expect(locationAssign).not.toHaveBeenCalled();
  });

  it("retries with the healed workspace after a 403 response on stale workspace", async () => {
    const { windowMock, locationAssign } = createWindowMock("workspace_old");
    vi.stubGlobal("window", windowMock);
    vi.stubGlobal("document", { cookie: "active_workspace_id=workspace_old" });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("forbidden", { status: 403 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ activeWorkspaceId: "workspace_new" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { workspaceFetch } = await import("../lib/workspace-client");
    const response = await workspaceFetch("/api/admin/users", { cache: "no-store" });

    expect(response.status).toBe(200);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin/users",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.any(Headers),
      }),
    );
    const firstCallHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(firstCallHeaders.get("x-workspace-id")).toBe("workspace_old");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/workspaces/memberships",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/admin/users",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.any(Headers),
      }),
    );
    const retriedHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Headers;
    expect(retriedHeaders.get("x-workspace-id")).toBe("workspace_new");
    expect(windowMock.localStorage.setItem).toHaveBeenCalledWith(
      "active_workspace_id",
      "workspace_new",
    );
    expect(locationAssign).not.toHaveBeenCalled();
  });

  it("does not redirect on ordinary forbidden when active workspace is still valid", async () => {
    const { windowMock, locationAssign } = createWindowMock("workspace_same");
    vi.stubGlobal("window", windowMock);
    vi.stubGlobal("document", { cookie: "active_workspace_id=workspace_same" });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("forbidden", { status: 403 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ activeWorkspaceId: "workspace_same" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { workspaceFetch } = await import("../lib/workspace-client");
    const response = await workspaceFetch("/api/admin/users", { cache: "no-store" });

    expect(response.status).toBe(403);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(locationAssign).not.toHaveBeenCalled();
  });
});
