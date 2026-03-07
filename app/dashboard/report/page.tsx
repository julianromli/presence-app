import { DashboardPageHeader } from '@/components/dashboard/page-header';
import { ReportPanel } from '@/components/dashboard/report-panel';
import { requireWorkspaceRolePageFromDb } from '@/lib/auth';

export default async function DashboardReportPage() {
  const session = await requireWorkspaceRolePageFromDb(['admin', 'superadmin']);
  const role = session.role === 'superadmin' ? 'superadmin' : 'admin';

  return (
    <>
      <DashboardPageHeader title="Manajemen Laporan" />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-4 md:px-6 md:py-6">
        <ReportPanel role={role} />
      </div>
    </>
  );
}
