import { requireRolePageFromDb } from '@/lib/auth';

import { SettingsPanel } from './settings-panel';

export default async function SettingsPage() {
  await requireRolePageFromDb(['superadmin']);

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold">Settings Superadmin</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Pengaturan timezone, geofence, dan whitelist IP untuk kebijakan absensi kantor.
      </p>
      <SettingsPanel />
    </div>
  );
}
