import {
  requireRoleApiFromDb,
  requireWorkspaceApiContextForMigration,
} from '@/lib/auth';

export async function GET(req: Request) {
  const workspaceContext = requireWorkspaceApiContextForMigration(req);
  if ('error' in workspaceContext) {
    return workspaceContext.error;
  }

  const result = await requireRoleApiFromDb(['admin', 'superadmin']);
  if ('error' in result) {
    return result.error;
  }

  return Response.json({ ok: true, role: result.session.role });
}
