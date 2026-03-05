import { EmployeeOverviewPanel } from '@/components/dashboard/employee-overview-panel';
import { DashboardPageHeader } from '@/components/dashboard/page-header';
import { OverviewPanel } from '@/components/dashboard/overview-panel';
import { requireWorkspaceRolePageFromDb } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await requireWorkspaceRolePageFromDb(['admin', 'superadmin', 'karyawan']);
  const isEmployee = session.role === 'karyawan';

  return (
    <>
      <DashboardPageHeader
        title={isEmployee ? 'Ringkasan Kehadiran Saya' : 'Ringkasan Operasional'}
        description={
          isEmployee
            ? 'Pantau disiplin check-in, tren personal, dan progress mingguan.'
            : undefined
        }
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-4 md:px-6 md:py-6">
        {isEmployee ? <EmployeeOverviewPanel /> : <OverviewPanel />}
      </div>
    </>
  );
}
