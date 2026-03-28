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

export type DeviceManagementWorkspaceChangeReset = {
  setupUrl: string | null;
  generatedCode: null;
  notice: null;
  registrationCodes: DeviceRegistrationCodeRow[];
  devices: ManagedDeviceRow[];
  registrationCodesStatus: "loading";
  devicesStatus: "loading";
  registrationCodesError: null;
  devicesError: null;
  renameDeviceId: null;
  renameDraft: "";
  submittingRenameId: null;
  confirmRevokeDevice: null;
  revokingDeviceId: null;
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

export function buildDeviceSetupUrl(_workspaceId: string | null, origin?: string | null) {
  const path = "/qr";
  if (!origin) {
    return path;
  }

  return `${origin.replace(/\/$/, "")}${path}`;
}

export function getLatestRegistrationCode(
  registrationCodes: DeviceRegistrationCodeRow[],
) {
  let latestPendingCode: DeviceRegistrationCodeRow | null = null;
  let latestCode: DeviceRegistrationCodeRow | null = null;

  for (const row of registrationCodes) {
    if (row.status === "pending" && (!latestPendingCode || row.createdAt > latestPendingCode.createdAt)) {
      latestPendingCode = row;
    }

    if (!latestCode || row.createdAt > latestCode.createdAt) {
      latestCode = row;
    }
  }

  return latestPendingCode ?? latestCode;
}

export function buildDeviceManagementWorkspaceChangeReset(
  workspaceId: string | null,
  origin?: string | null,
): DeviceManagementWorkspaceChangeReset {
  return {
    setupUrl: buildDeviceSetupUrl(workspaceId, origin),
    generatedCode: null,
    notice: null,
    registrationCodes: [],
    devices: [],
    registrationCodesStatus: "loading",
    devicesStatus: "loading",
    registrationCodesError: null,
    devicesError: null,
    renameDeviceId: null,
    renameDraft: "",
    submittingRenameId: null,
    confirmRevokeDevice: null,
    revokingDeviceId: null,
  };
}
