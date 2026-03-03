import { requireRolePageFromDb } from '@/lib/auth';

import { DeviceQrPanel } from './device-qr-panel';

export default async function DeviceQrPage() {
  await requireRolePageFromDb(['device-qr']);

  return <DeviceQrPanel />;
}
