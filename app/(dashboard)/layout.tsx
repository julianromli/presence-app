import { DashboardAppShell } from '@/components/dashboard/app-shell';
import { requireWorkspaceOnboardingPage, requireWorkspaceRolePageFromDb } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireWorkspaceOnboardingPage();
  const session = await requireWorkspaceRolePageFromDb(['admin', 'superadmin']);
  if (!session.user) {
    redirect('/forbidden');
  }
  const role = session.role === 'superadmin' ? 'superadmin' : 'admin';

  return (
    <DashboardAppShell role={role} name={session.user.name} email={session.user.email}>
      {children}
    </DashboardAppShell>
  );
}
