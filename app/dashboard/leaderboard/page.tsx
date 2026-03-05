import { EmployeeLeaderboardPanel } from '@/components/dashboard/employee-leaderboard-panel';
import { DashboardPageHeader } from '@/components/dashboard/page-header';
import { requireWorkspaceRolePageFromDb } from '@/lib/auth';

export default async function DashboardLeaderboardPage() {
  await requireWorkspaceRolePageFromDb(['karyawan']);

  return (
    <>
      <DashboardPageHeader
        title="Leaderboard Mingguan"
        description="Bandingkan performa disiplinmu dengan tim dan capai badge tertinggi."
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-4 md:px-6 md:py-6">
        <EmployeeLeaderboardPanel />
      </div>
    </>
  );
}

