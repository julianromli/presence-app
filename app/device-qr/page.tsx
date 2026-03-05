import { requireWorkspaceOnboardingPage, requireWorkspaceRolePageFromDb } from '@/lib/auth';

import { DeviceQrPanel } from './device-qr-panel';

export default async function DeviceQrPage() {
  await requireWorkspaceOnboardingPage();
  await requireWorkspaceRolePageFromDb(['device-qr']);

  return <DeviceQrPanel />;
}
