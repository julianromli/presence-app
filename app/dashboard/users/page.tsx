import { UsersPanel } from '@/components/dashboard/users-panel';
import { requireRolePageFromDb } from '@/lib/auth';

export default async function DashboardUsersPage() {
  const session = await requireRolePageFromDb(['admin', 'superadmin']);

  const viewerRole = session.role === 'superadmin' ? 'superadmin' : 'admin';
  return <UsersPanel viewerRole={viewerRole} />;
}
