'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { normalizeClientError, parseApiErrorResponse } from '@/lib/client-error';
import {
  buildWorkspaceMutationNotice,
  resolveActiveWorkspaceName,
  type WorkspaceHubMembership,
} from '@/components/dashboard/workspace-hub-state';
import {
  activateWorkspaceInBrowser,
  createWorkspaceAndActivate,
  joinWorkspaceAndActivate,
  recoverWorkspaceScopeViolation,
  workspaceFetch,
} from '@/lib/workspace-client';

type WorkspaceHubMembershipsResponse = {
  memberships: WorkspaceHubMembership[];
  activeWorkspaceId: string | null;
};

type WorkspaceHubNotice = {
  tone: 'error' | 'success' | 'info';
  text: string;
};

type WorkspaceHubPendingAction = 'none' | 'switch' | 'create' | 'join';

type WorkspaceHubContextValue = {
  memberships: WorkspaceHubMembership[];
  activeWorkspaceId: string | null;
  activeWorkspaceName: string;
  loading: boolean;
  pendingAction: WorkspaceHubPendingAction;
  notice: WorkspaceHubNotice | null;
  clearNotice: () => void;
  refreshMemberships: () => Promise<boolean>;
  switchWorkspace: (workspaceId: string) => Promise<boolean>;
  createWorkspace: (name: string) => Promise<boolean>;
  joinWorkspace: (code: string) => Promise<boolean>;
};

const WorkspaceHubContext = createContext<WorkspaceHubContextValue | undefined>(
  undefined,
);

function emitWorkspaceChange(workspaceId: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent('workspace:changed', {
      detail: { workspaceId },
    }),
  );
  window.dispatchEvent(new CustomEvent('dashboard:refresh'));
}

type LoadMembershipsOptions = {
  silent?: boolean;
  surfaceErrors?: boolean;
};

export function WorkspaceHubProvider({ children }: { children: ReactNode }) {
  const [memberships, setMemberships] = useState<WorkspaceHubMembership[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] =
    useState<WorkspaceHubPendingAction>('none');
  const [notice, setNotice] = useState<WorkspaceHubNotice | null>(null);
  const [optimisticActiveWorkspaceName, setOptimisticActiveWorkspaceName] =
    useState<string | null>(null);

  const loadMemberships = useCallback(
    async (options?: LoadMembershipsOptions) => {
      if (!options?.silent) {
        setLoading(true);
      }

      try {
        const response = await workspaceFetch('/api/workspaces/memberships', {
          cache: 'no-store',
        });
        if (!response.ok) {
          const error = await parseApiErrorResponse(
            response,
            'Gagal memuat daftar workspace.',
          );
          if (recoverWorkspaceScopeViolation(error.code)) {
            return false;
          }
          if (options?.surfaceErrors !== false) {
            setNotice({ tone: 'error', text: `[${error.code}] ${error.message}` });
          }
          return false;
        }

        const payload =
          (await response.json()) as WorkspaceHubMembershipsResponse;
        setMemberships(payload.memberships);
        setActiveWorkspaceId(payload.activeWorkspaceId);
        setOptimisticActiveWorkspaceName(null);
        return true;
      } catch (error) {
        const normalized = await normalizeClientError(
          error,
          'Gagal memuat daftar workspace.',
        );
        if (options?.surfaceErrors !== false) {
          setNotice({
            tone: 'error',
            text: `[${normalized.code}] ${normalized.message}`,
          });
        }
        return false;
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadMemberships();
  }, [loadMemberships]);

  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      if (!workspaceId || workspaceId === activeWorkspaceId) {
        return true;
      }

      setPendingAction('switch');
      setNotice(null);
      try {
        const result = await activateWorkspaceInBrowser(workspaceId);
        if (!result.ok) {
          const error = await parseApiErrorResponse(
            result.response,
            'Gagal mengganti workspace aktif.',
          );
          if (recoverWorkspaceScopeViolation(error.code)) {
            return false;
          }
          setNotice({ tone: 'error', text: `[${error.code}] ${error.message}` });
          return false;
        }

        setActiveWorkspaceId(result.workspaceId);
        setOptimisticActiveWorkspaceName(null);
        setNotice({
          tone: 'success',
          text: 'Workspace aktif berhasil diganti.',
        });
        emitWorkspaceChange(result.workspaceId);
        return true;
      } finally {
        setPendingAction('none');
      }
    },
    [activeWorkspaceId],
  );

  const createWorkspace = useCallback(async (name: string) => {
    setPendingAction('create');
    setNotice(null);

    try {
      const result = await createWorkspaceAndActivate(name);
      if (!result.ok) {
        const fallbackMessage =
          result.stage === 'activate'
            ? 'Workspace berhasil dibuat, tapi gagal set workspace aktif.'
            : 'Gagal membuat workspace baru.';
        const error = await parseApiErrorResponse(result.response, fallbackMessage);
        if (recoverWorkspaceScopeViolation(error.code)) {
          return false;
        }
        setNotice({ tone: 'error', text: `[${error.code}] ${error.message}` });
        return false;
      }

      setActiveWorkspaceId(result.workspaceId);
      setOptimisticActiveWorkspaceName(name.trim());
      const refreshSucceeded = await loadMemberships({
        silent: true,
        surfaceErrors: false,
      });
      setNotice(
        buildWorkspaceMutationNotice({
          refreshSucceeded,
          successText: 'Workspace baru berhasil dibuat dan langsung dipilih.',
          refreshFailureText:
            'Workspace baru berhasil dipilih, tapi daftar workspace belum terbarui.',
        }),
      );
      emitWorkspaceChange(result.workspaceId);
      return true;
    } finally {
      setPendingAction('none');
    }
  }, [loadMemberships]);

  const joinWorkspace = useCallback(async (code: string) => {
    setPendingAction('join');
    setNotice(null);

    try {
      const result = await joinWorkspaceAndActivate(code);
      if (!result.ok) {
        const fallbackMessage =
          result.stage === 'activate'
            ? 'Berhasil join, tapi gagal set workspace aktif.'
            : 'Gagal bergabung ke workspace.';
        const error = await parseApiErrorResponse(result.response, fallbackMessage);
        if (recoverWorkspaceScopeViolation(error.code)) {
          return false;
        }
        setNotice({ tone: 'error', text: `[${error.code}] ${error.message}` });
        return false;
      }

      setActiveWorkspaceId(result.workspaceId);
      setOptimisticActiveWorkspaceName(result.workspaceName ?? null);
      const refreshSucceeded = await loadMemberships({
        silent: true,
        surfaceErrors: false,
      });
      setNotice(
        buildWorkspaceMutationNotice({
          refreshSucceeded,
          successText: 'Workspace berhasil ditambahkan dan langsung dipilih.',
          refreshFailureText:
            'Workspace berhasil dipilih, tapi daftar workspace belum terbarui.',
        }),
      );
      emitWorkspaceChange(result.workspaceId);
      return true;
    } finally {
      setPendingAction('none');
    }
  }, [loadMemberships]);

  const activeWorkspaceName = useMemo(
    () =>
      resolveActiveWorkspaceName({
        memberships,
        activeWorkspaceId,
        loading,
        optimisticActiveWorkspaceName,
      }),
    [activeWorkspaceId, loading, memberships, optimisticActiveWorkspaceName],
  );

  const value = useMemo<WorkspaceHubContextValue>(
    () => ({
      memberships,
      activeWorkspaceId,
      activeWorkspaceName,
      loading,
      pendingAction,
      notice,
      clearNotice: () => setNotice(null),
      refreshMemberships: async () => await loadMemberships(),
      switchWorkspace,
      createWorkspace,
      joinWorkspace,
    }),
    [
      activeWorkspaceId,
      activeWorkspaceName,
      createWorkspace,
      joinWorkspace,
      loadMemberships,
      loading,
      memberships,
      notice,
      pendingAction,
      switchWorkspace,
    ],
  );

  return (
    <WorkspaceHubContext.Provider value={value}>
      {children}
    </WorkspaceHubContext.Provider>
  );
}

export function useWorkspaceHub() {
  const context = useContext(WorkspaceHubContext);
  if (!context) {
    throw new Error('useWorkspaceHub must be used within a WorkspaceHubProvider');
  }

  return context;
}
