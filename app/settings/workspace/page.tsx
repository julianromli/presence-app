import { DashboardPageHeader } from '@/components/dashboard/page-header';
import { WorkspacePanel } from '@/components/dashboard/workspace-panel';
import { requireWorkspaceRolePageFromDb } from '@/lib/auth';

export default async function WorkspaceSettingsPage() {
  await requireWorkspaceRolePageFromDb(['superadmin']);

  return (
    <>
      <DashboardPageHeader title="Workspace Management" />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-4 md:px-6 md:py-6">
        <WorkspacePanel />
      </div>
    </>
  );
}
