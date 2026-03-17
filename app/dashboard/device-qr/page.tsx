import { DeviceManagementPanel } from "@/components/dashboard/device-management-panel";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { requireWorkspaceRolePageFromDb } from "@/lib/auth";

export default async function DashboardDeviceQrPage() {
  await requireWorkspaceRolePageFromDb(["superadmin"]);

  return (
    <>
      <DashboardPageHeader
        title="Device QR"
        description="Control center untuk registration code, monitoring device, rename, dan revoke perangkat QR permanen."
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-4 md:px-6 md:py-6">
        <DeviceManagementPanel role="superadmin" />
      </div>
    </>
  );
}
