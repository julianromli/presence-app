import { DashboardLayout as DashboardShellLayout } from '@/components/dashboard/layout';
import { requireWorkspaceOnboardingPage, requireWorkspaceRolePageFromDb } from '@/lib/auth';
import { redirect } from 'next/navigation';

// Retained as a compatibility shim because Next/Turbopack may still reference this layout.
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireWorkspaceOnboardingPage();
  const session = await requireWorkspaceRolePageFromDb(['admin', 'superadmin', 'karyawan']);
  if (!session.user) {
    redirect('/forbidden');
  }
  const role =
    session.role === 'superadmin'
      ? 'superadmin'
      : session.role === 'admin'
        ? 'admin'
        : 'karyawan';

  return (
    <DashboardShellLayout role={role} name={session.user.name} email={session.user.email}>
      {children}
    </DashboardShellLayout>
  );
}
