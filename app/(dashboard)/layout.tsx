import { DashboardAppShell } from '@/components/dashboard/app-shell';
import { requireRolePageFromDb } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireRolePageFromDb(['admin', 'superadmin']);
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
