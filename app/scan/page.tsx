import { currentUser } from '@clerk/nextjs/server';

import { requireWorkspaceRolePageFromDb } from '@/lib/auth';

import { ScanPanel } from './scan-panel';

export default async function ScanPage() {
  const [, clerkUser] = await Promise.all([
    requireWorkspaceRolePageFromDb(['karyawan']),
    currentUser(),
  ]);

  return <ScanPanel firstName={clerkUser?.username?.trim() || 'Karyawan'} />;
}
