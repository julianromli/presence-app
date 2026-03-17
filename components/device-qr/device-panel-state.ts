import type { DeviceSession } from "@/lib/device-auth";

export type DeviceQrPanelStep = "enter-code" | "name-device" | "active-device";

export type DeviceQrPanelState = {
  step: DeviceQrPanelStep;
  pendingCode: string | null;
  session: DeviceSession | null;
};

export function getInitialDeviceQrPanelState(
  session: DeviceSession | null,
): DeviceQrPanelState {
  if (!session) {
    return {
      step: "enter-code",
      pendingCode: null,
      session: null,
    };
  }

  return {
    step: "active-device",
    pendingCode: null,
    session,
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
  session: DeviceSession,
): DeviceQrPanelState {
  return {
    step: "active-device",
    pendingCode: null,
    session,
  };
}

export function resolveDeviceAuthRestore(
  session: DeviceSession | null,
  isAuthorized: boolean,
): DeviceQrPanelState {
  if (session && isAuthorized) {
    return {
      step: "active-device",
      pendingCode: null,
      session,
    };
  }

  return {
    step: "enter-code",
    pendingCode: null,
    session: null,
  };
}
