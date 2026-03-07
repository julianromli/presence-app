import type { StoredDeviceSession } from "@/lib/device-auth";

export type DeviceQrPanelStep = "enter-code" | "name-device" | "active-device";

export type DeviceQrPanelState = {
  step: DeviceQrPanelStep;
  pendingCode: string | null;
  session: StoredDeviceSession | null;
};

export function getInitialDeviceQrPanelState(
  storedSession: StoredDeviceSession | null,
): DeviceQrPanelState {
  if (!storedSession) {
    return {
      step: "enter-code",
      pendingCode: null,
      session: null,
    };
  }

  return {
    step: "active-device",
    pendingCode: null,
    session: storedSession,
  };
}

export function advanceToDeviceNaming(code: string): DeviceQrPanelState {
  return {
    step: "name-device",
    pendingCode: code,
    session: null,
  };
}

export function finalizeDeviceClaim(
  session: StoredDeviceSession,
): DeviceQrPanelState {
  return {
    step: "active-device",
    pendingCode: null,
    session,
  };
}

export function resolveDeviceAuthRestore(
  storedSession: StoredDeviceSession | null,
  isAuthorized: boolean,
): DeviceQrPanelState {
  if (storedSession && isAuthorized) {
    return {
      step: "active-device",
      pendingCode: null,
      session: storedSession,
    };
  }

  return {
    step: "enter-code",
    pendingCode: null,
    session: null,
  };
}
