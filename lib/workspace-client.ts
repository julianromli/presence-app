import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace-context";

export function getActiveWorkspaceIdFromBrowser() {
  if (typeof document === "undefined") {
    return null;
  }

  const cookieValue = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${ACTIVE_WORKSPACE_COOKIE}=`))
    ?.split("=")[1];

  if (cookieValue && cookieValue.length > 0) {
    return decodeURIComponent(cookieValue);
  }

  try {
    const fromStorage = window.localStorage.getItem(ACTIVE_WORKSPACE_COOKIE);
    if (fromStorage && fromStorage.length > 0) {
      return fromStorage;
    }
  } catch {
    return null;
  }

  return null;
}

export function setActiveWorkspaceIdInBrowser(workspaceId: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ACTIVE_WORKSPACE_COOKIE, workspaceId);
  } catch {
    // ignore storage failures in private mode
  }
}

export async function workspaceFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const headers = new Headers(init?.headers ?? undefined);
  const workspaceId = getActiveWorkspaceIdFromBrowser();
  if (workspaceId && !headers.has("x-workspace-id")) {
    headers.set("x-workspace-id", workspaceId);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
