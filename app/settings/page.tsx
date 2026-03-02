import { requireRolePage } from '@/lib/auth';

export default async function SettingsPage() {
  await requireRolePage(['superadmin']);

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold">Settings Superadmin</h1>
      <p className="text-muted-foreground mt-3">
        Halaman pengaturan policy (timezone, geofence, whitelist IP) akan aktif di task berikutnya.
      </p>
    </div>
  );
}
