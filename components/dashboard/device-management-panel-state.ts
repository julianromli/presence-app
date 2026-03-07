import type {
  DeviceRegistrationCodeRow,
  ManagedDeviceRow,
} from "@/types/dashboard";

type DeviceManagementRole = "admin" | "superadmin" | "karyawan";

export type GeneratedRegistrationCode = {
  code: string;
  createdAt: number;
  expiresAt: number;
};

export function isDeviceManagementVisible(role: DeviceManagementRole) {
  return role === "superadmin";
}

export function buildDeviceManagementPanelState({
  role,
  registrationCodes,
  devices,
}: {
  role: DeviceManagementRole;
  registrationCodes: DeviceRegistrationCodeRow[];
  devices: ManagedDeviceRow[];
}) {
  return {
    visible: isDeviceManagementVisible(role),
    registrationCodes,
    devices,
  };
}

export function startRenameSubmission(deviceId: string) {
  return {
    submittingRenameId: deviceId,
  };
}

export function buildGeneratedCodeNotice(
  generatedCode: GeneratedRegistrationCode | null,
) {
  if (!generatedCode) {
    return null;
  }

  return {
    title: "Registration code terbaru",
    code: generatedCode.code,
    expiresAt: generatedCode.expiresAt,
  };
}

export function buildDeviceSetupUrl(workspaceId: string | null, origin?: string | null) {
  if (!workspaceId) {
    return null;
  }

  const path = `/device-qr?workspaceId=${encodeURIComponent(workspaceId)}`;
  if (!origin) {
    return path;
  }

  return `${origin.replace(/\/$/, "")}${path}`;
}

export function toggleRevokeConfirmation(
  currentDeviceId: string | null,
  nextDeviceId: string,
) {
  return currentDeviceId === nextDeviceId ? null : nextDeviceId;
}
