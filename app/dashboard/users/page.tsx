import { UsersPanel } from '@/components/dashboard/users-panel';
import { requireWorkspaceRolePageFromDb } from '@/lib/auth';

export default async function DashboardUsersPage() {
  const session = await requireWorkspaceRolePageFromDb(['admin', 'superadmin']);

  const viewerRole = session.role === 'superadmin' ? 'superadmin' : 'admin';
  return <UsersPanel viewerRole={viewerRole} />;
}
