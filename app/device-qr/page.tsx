import { requireRolePageFromDb, requireWorkspaceOnboardingPage } from '@/lib/auth';

import { DeviceQrPanel } from './device-qr-panel';

export default async function DeviceQrPage() {
  await requireWorkspaceOnboardingPage();
  await requireRolePageFromDb(['device-qr']);

  return <DeviceQrPanel />;
}
