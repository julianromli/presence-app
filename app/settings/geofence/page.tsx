import { GeofencePanel } from '@/components/dashboard/geofence-panel';
import { requireRolePageFromDb } from '@/lib/auth';

export default async function GeofenceSettingsPage() {
  await requireRolePageFromDb(['superadmin']);

  return <GeofencePanel />;
}