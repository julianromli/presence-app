import { setActiveWorkspaceIdInBrowser } from "@/lib/workspace-client";

type WorkspaceFetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type MembershipsBootstrapPayload = {
  activeWorkspaceId: string | null;
};

export async function bootstrapActiveWorkspaceForMember(
  workspaceFetchFn: WorkspaceFetchLike,
) {
  const membershipsResponse = await workspaceFetchFn("/api/workspaces/memberships", {
    method: "GET",
    cache: "no-store",
  });
  if (!membershipsResponse.ok) {
    return null;
  }

  const membershipsPayload = (await membershipsResponse.json()) as MembershipsBootstrapPayload;
  const activeWorkspaceId = membershipsPayload.activeWorkspaceId;
  if (!activeWorkspaceId) {
    return null;
  }

  const setActiveResponse = await workspaceFetchFn("/api/workspaces/active", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId: activeWorkspaceId }),
  });
  if (!setActiveResponse.ok) {
    return null;
  }

  setActiveWorkspaceIdInBrowser(activeWorkspaceId);
  return activeWorkspaceId;
}
