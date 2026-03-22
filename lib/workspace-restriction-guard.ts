import { buildRestrictedWorkspaceMessage, isBillingActionAllowedDuringRestriction } from '@/lib/workspace-billing';
import type { WorkspaceRestrictedExpiredStatePayload } from '@/types/dashboard';

type WorkspaceRestrictionAction = Parameters<typeof isBillingActionAllowedDuringRestriction>[1];
type WorkspaceRestrictionRole = Parameters<typeof isBillingActionAllowedDuringRestriction>[0];

type ConvexLike = {
  query: <T>(name: string, args: { workspaceId: string }) => Promise<T>;
};

export async function getWorkspaceRestrictionState(
  convex: ConvexLike,
  workspaceId: string,
) {
  return await convex.query<WorkspaceRestrictedExpiredStatePayload>(
    'workspaceBilling:getWorkspaceRestrictedExpiredState',
    { workspaceId },
  );
}

export async function enforceWorkspaceRestriction(
  convex: ConvexLike,
  workspaceId: string,
  role: WorkspaceRestrictionRole,
  action: WorkspaceRestrictionAction,
) {
  const restrictionState = await getWorkspaceRestrictionState(convex, workspaceId);
  if (!restrictionState.isRestricted) {
    return null;
  }

  if (isBillingActionAllowedDuringRestriction(role, action)) {
    return null;
  }

  return Response.json(
    {
      code: 'WORKSPACE_RESTRICTED_EXPIRED',
      message: buildRestrictedWorkspaceMessage(),
    },
    { status: 409 },
  );
}
