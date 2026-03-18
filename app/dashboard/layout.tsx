import type { Metadata } from 'next';

import { AppClerkProvider } from '@/components/providers/app-clerk-provider';
import { DashboardLayout as DashboardShellLayout } from '@/components/dashboard/layout';
import { requireWorkspaceOnboardingPage, requireWorkspaceRolePageFromDb } from '@/lib/auth';
import { NOINDEX_METADATA } from '@/lib/seo';
import { redirect } from 'next/navigation';

export const metadata: Metadata = NOINDEX_METADATA;

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
    <AppClerkProvider enableConvex enableUserSync>
      <DashboardShellLayout role={role} name={session.user.name} email={session.user.email}>
        {children}
      </DashboardShellLayout>
    </AppClerkProvider>
  );
}
