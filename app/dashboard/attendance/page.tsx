import { EmployeeAttendancePanel } from '@/components/dashboard/employee-attendance-panel';
import { DashboardPageHeader } from '@/components/dashboard/page-header';
import { requireWorkspaceRolePageFromDb } from '@/lib/auth';

export default async function DashboardAttendancePage() {
  await requireWorkspaceRolePageFromDb(['karyawan']);

  return (
    <>
      <DashboardPageHeader
        title="Riwayat Absensi Saya"
        description="Audit detail check-in, check-out, durasi, dan poin harian."
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-4 md:px-6 md:py-6">
        <EmployeeAttendancePanel />
      </div>
    </>
  );
}

