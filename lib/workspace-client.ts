import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace-context";

type WorkspaceActionFailureStage = "switch" | "create" | "join" | "activate";

type WorkspaceActionSuccess = {
  ok: true;
  workspaceId: string;
  workspaceName?: string;
};

type WorkspaceActionFailure = {
  ok: false;
  stage: WorkspaceActionFailureStage;
  response: Response;
  workspaceId?: string;
};

type WorkspaceMutationPayload = {
  workspaceId: string;
  workspaceName?: string;
};

function buildWorkspaceMutationErrorResponse(message: string) {
  return Response.json(
    {
      code: "INTERNAL_ERROR",
      message,
    },
    { status: 500 },
  );
}

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

type ActiveWorkspaceHealResult = {
  changed: boolean;
  activeWorkspaceId: string | null;
};

async function healActiveWorkspaceFromServer(
  currentWorkspaceId: string | null,
  options?: { navigate?: boolean },
): Promise<ActiveWorkspaceHealResult> {
  const navigate = options?.navigate ?? true;

  try {
    const res = await fetch("/api/workspaces/memberships", { cache: "no-store" });
    if (!res.ok) {
      return { changed: false, activeWorkspaceId: currentWorkspaceId };
    }

    const payload = (await res.json()) as {
      activeWorkspaceId: string | null;
    };

    if (payload.activeWorkspaceId === currentWorkspaceId) {
      return { changed: false, activeWorkspaceId: currentWorkspaceId };
    }

    if (!payload.activeWorkspaceId) {
      clearActiveWorkspaceIdInBrowser();
      if (navigate) {
        window.location.assign("/onboarding/workspace");
      }
      return { changed: true, activeWorkspaceId: null };
    }

    setActiveWorkspaceIdInBrowser(payload.activeWorkspaceId);
    if (navigate) {
      window.location.assign("/dashboard");
    }
    return { changed: true, activeWorkspaceId: payload.activeWorkspaceId };
  } catch {
    return { changed: false, activeWorkspaceId: currentWorkspaceId };
  }
}

async function resolveActiveWorkspaceIdForRequest() {
  const currentWorkspaceId = getActiveWorkspaceIdFromBrowser();
  if (currentWorkspaceId || typeof window === "undefined") {
    return currentWorkspaceId;
  }

  const healed = await healActiveWorkspaceFromServer(null, { navigate: false });
  return healed.activeWorkspaceId;
}

export async function workspaceFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const headers = new Headers(init?.headers ?? undefined);
  const workspaceId = await resolveActiveWorkspaceIdForRequest();
  if (workspaceId && !headers.has("x-workspace-id")) {
    headers.set("x-workspace-id", workspaceId);
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (response.status === 403 && workspaceId && typeof window !== "undefined") {
    const healed = await healActiveWorkspaceFromServer(workspaceId, { navigate: false });
    if (healed.changed && healed.activeWorkspaceId && healed.activeWorkspaceId !== workspaceId) {
      const retryHeaders = new Headers(init?.headers ?? undefined);
      retryHeaders.set("x-workspace-id", healed.activeWorkspaceId);
      return await fetch(input, {
        ...init,
        headers: retryHeaders,
      });
    }

    if (healed.changed && !healed.activeWorkspaceId) {
      window.location.assign("/onboarding/workspace");
    }
  }

  return response;
}

async function postWorkspaceMutation(
  path: string,
  body: Record<string, string>,
) {
  try {
    return await workspaceFetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return buildWorkspaceMutationErrorResponse("Permintaan workspace gagal diproses.");
  }
}

async function readWorkspaceMutationPayload(response: Response) {
  try {
    return (await response.json()) as WorkspaceMutationPayload;
  } catch {
    return null;
  }
}

export async function activateWorkspaceInBrowser(
  workspaceId: string,
): Promise<WorkspaceActionSuccess | WorkspaceActionFailure> {
  const response = await postWorkspaceMutation("/api/workspaces/active", { workspaceId });
  if (!response.ok) {
    return {
      ok: false,
      stage: "switch",
      response,
      workspaceId,
    };
  }

  setActiveWorkspaceIdInBrowser(workspaceId);
  return {
    ok: true,
    workspaceId,
  };
}

export async function createWorkspaceAndActivate(
  name: string,
): Promise<WorkspaceActionSuccess | WorkspaceActionFailure> {
  const createResponse = await postWorkspaceMutation("/api/workspaces/create", { name });
  if (!createResponse.ok) {
    return {
      ok: false,
      stage: "create",
      response: createResponse,
    };
  }

  const payload = await readWorkspaceMutationPayload(createResponse);
  if (!payload?.workspaceId) {
    return {
      ok: false,
      stage: "create",
      response: buildWorkspaceMutationErrorResponse("Respons workspace baru tidak valid."),
    };
  }
  const activateResponse = await postWorkspaceMutation("/api/workspaces/active", {
    workspaceId: payload.workspaceId,
  });
  if (!activateResponse.ok) {
    return {
      ok: false,
      stage: "activate",
      response: activateResponse,
      workspaceId: payload.workspaceId,
    };
  }

  setActiveWorkspaceIdInBrowser(payload.workspaceId);
  return {
    ok: true,
    workspaceId: payload.workspaceId,
  };
}

export async function joinWorkspaceAndActivate(
  code: string,
): Promise<WorkspaceActionSuccess | WorkspaceActionFailure> {
  const joinResponse = await postWorkspaceMutation("/api/workspaces/join", { code });
  if (!joinResponse.ok) {
    return {
      ok: false,
      stage: "join",
      response: joinResponse,
    };
  }

  const payload = await readWorkspaceMutationPayload(joinResponse);
  if (!payload?.workspaceId) {
    return {
      ok: false,
      stage: "join",
      response: buildWorkspaceMutationErrorResponse("Respons join workspace tidak valid."),
    };
  }
  const activateResponse = await postWorkspaceMutation("/api/workspaces/active", {
    workspaceId: payload.workspaceId,
  });
  if (!activateResponse.ok) {
    return {
      ok: false,
      stage: "activate",
      response: activateResponse,
      workspaceId: payload.workspaceId,
    };
  }

  setActiveWorkspaceIdInBrowser(payload.workspaceId);
  return {
    ok: true,
    workspaceId: payload.workspaceId,
    workspaceName: payload.workspaceName,
  };
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
      if (healed.changed) {
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
