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

export function clearActiveWorkspaceIdInBrowser() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(ACTIVE_WORKSPACE_COOKIE);
  } catch {
    // ignore storage failures in private mode
  }

  document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=; path=/; max-age=0`;
}

async function healActiveWorkspaceFromServer(currentWorkspaceId: string | null) {
  try {
    const res = await fetch("/api/workspaces/memberships", { cache: "no-store" });
    if (!res.ok) {
      return false;
    }

    const payload = (await res.json()) as {
      activeWorkspaceId: string | null;
    };

    if (payload.activeWorkspaceId === currentWorkspaceId) {
      return false;
    }

    if (!payload.activeWorkspaceId) {
      clearActiveWorkspaceIdInBrowser();
      window.location.assign("/onboarding/workspace");
      return true;
    }

    setActiveWorkspaceIdInBrowser(payload.activeWorkspaceId);
    window.location.assign("/dashboard");
    return true;
  } catch {
    return false;
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

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (response.status === 403 && workspaceId && typeof window !== "undefined") {
    void healActiveWorkspaceFromServer(workspaceId);
  }

  return response;
}

export function recoverWorkspaceScopeViolation(code: string) {
  if (typeof window === "undefined") {
    return false;
  }

  if (
    code !== "WORKSPACE_REQUIRED" &&
    code !== "WORKSPACE_INVALID" &&
    code !== "WORKSPACE_ACCESS_LOST" &&
    code !== "ONBOARDING_REQUIRED"
  ) {
    return false;
  }

  void (async () => {
    try {
      const healed = await healActiveWorkspaceFromServer(getActiveWorkspaceIdFromBrowser());
      if (healed) {
        return;
      }
      clearActiveWorkspaceIdInBrowser();
      window.location.assign("/onboarding/workspace");
    } catch {
      clearActiveWorkspaceIdInBrowser();
      window.location.assign("/onboarding/workspace");
    }
  })();

  return true;
}
