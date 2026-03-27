import type { DeviceSession } from "@/lib/device-auth";

export type DeviceQrPanelStep = "enter-code" | "active-device";

export type DeviceQrPanelState = {
  step: DeviceQrPanelStep;
  session: DeviceSession | null;
};

export function getInitialDeviceQrPanelState(
  session: DeviceSession | null,
): DeviceQrPanelState {
  if (!session) {
    return {
      step: "enter-code",
      session: null,
    };
  }

  return {
    step: "active-device",
    session,
  };
}

export function finalizeDeviceClaim(
  session: DeviceSession,
): DeviceQrPanelState {
  return {
    step: "active-device",
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
      session,
    };
  }

  return {
    step: "enter-code",
    session: null,
  };
}
