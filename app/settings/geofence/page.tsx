import { GeofencePanel } from '@/components/dashboard/geofence-panel';
import { requireWorkspaceRolePageFromDb } from '@/lib/auth';

export default async function GeofenceSettingsPage() {
  await requireWorkspaceRolePageFromDb(['superadmin']);

  return <GeofencePanel />;
}
