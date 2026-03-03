import { requireRolePageFromDb } from '@/lib/auth';

import { ScanPanel } from './scan-panel';

export default async function ScanPage() {
  await requireRolePageFromDb(['karyawan']);

  return <ScanPanel />;
}
