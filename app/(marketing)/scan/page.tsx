import { requireWorkspaceRolePageFromDb } from '@/lib/auth';

import { ScanPanel } from './scan-panel';

export default async function ScanPage() {
  await requireWorkspaceRolePageFromDb(['karyawan']);

  return <ScanPanel />;
}
