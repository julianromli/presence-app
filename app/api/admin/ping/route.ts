import {
  requireWorkspaceRoleApiFromDb,
  requireWorkspaceApiContext,
} from '@/lib/auth';
import { getConvexTokenOrNull } from '@/lib/auth';
import { getAuthedConvexHttpClient } from '@/lib/convex-http';
import { enforceWorkspaceRestriction } from '@/lib/workspace-restriction-guard';

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContext(req);
  if ('error' in workspaceContext) {
    return workspaceContext.error;
  }

  const result = await requireWorkspaceRoleApiFromDb(
    ['admin', 'superadmin'],
    workspaceContext.workspace.workspaceId,
  );
  if ('error' in result) {
    return result.error;
  }

  const token = await getConvexTokenOrNull();
  if (!token) {
    return Response.json({ code: 'UNAUTHENTICATED', message: 'Unauthorized' }, { status: 401 });
  }

  const convex = getAuthedConvexHttpClient(token);
  if (!convex) {
    return Response.json({ code: 'INTERNAL_ERROR', message: 'Convex URL missing' }, { status: 500 });
  }

  const restrictionResponse = await enforceWorkspaceRestriction(
    convex,
    workspaceContext.workspace.workspaceId,
    result.session.role,
    'dashboard_overview',
  );
  if (restrictionResponse) {
    return restrictionResponse;
  }

  return Response.json({ ok: true, role: result.session.role });
}

