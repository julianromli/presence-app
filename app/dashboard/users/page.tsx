import { DashboardPageHeader } from '@/components/dashboard/page-header';
import { UsersPanel } from '@/components/dashboard/users-panel';
import { requireWorkspaceRolePageFromDb } from '@/lib/auth';

export default async function DashboardUsersPage() {
  const session = await requireWorkspaceRolePageFromDb(['admin', 'superadmin']);

  const viewerRole = session.role === 'superadmin' ? 'superadmin' : 'admin';
  return (
    <>
      <DashboardPageHeader title="Manajemen Karyawan" />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-4 md:px-6 md:py-6">
        <UsersPanel viewerRole={viewerRole} readOnly />
      </div>
    </>
  );
}
