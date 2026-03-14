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

export function startRevokeSubmission(deviceId: string) {
  return {
    revokingDeviceId: deviceId,
  };
}

export function buildDeviceRevokeConfirmation(deviceLabel: string) {
  return {
    title: "Cabut device ini sekarang?",
    description: `Device "${deviceLabel}" akan dicabut dari workspace ini dan perlu dipairing ulang.`,
    confirmLabel: "Ya, revoke",
    cancelLabel: "Batal",
    tone: "destructive" as const,
  };
}

export function isDeviceActionPending(deviceId: string, activeDeviceId: string | null) {
  return deviceId === activeDeviceId;
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
