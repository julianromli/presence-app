export type WorkspaceHubMembership = {
  workspace: {
    _id: string;
    name: string;
    slug: string;
  };
  role: 'superadmin' | 'admin' | 'karyawan' | 'device-qr';
};

export function resolveActiveWorkspaceName({
  memberships,
  activeWorkspaceId,
  loading,
  optimisticActiveWorkspaceName,
}: {
  memberships: WorkspaceHubMembership[];
  activeWorkspaceId: string | null;
  loading: boolean;
  optimisticActiveWorkspaceName: string | null;
}) {
  const activeMembership = memberships.find(
    (item) => item.workspace._id === activeWorkspaceId,
  );

  if (activeMembership) {
    return activeMembership.workspace.name;
  }

  if (optimisticActiveWorkspaceName) {
    return optimisticActiveWorkspaceName;
  }

  return loading ? 'Memuat...' : 'Tidak ada workspace';
}

export function buildWorkspaceMutationNotice({
  refreshSucceeded,
  successText,
  refreshFailureText,
}: {
  refreshSucceeded: boolean;
  successText: string;
  refreshFailureText: string;
}) {
  return refreshSucceeded
    ? { tone: 'success' as const, text: successText }
    : { tone: 'info' as const, text: refreshFailureText };
}
