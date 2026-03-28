import { describe, expect, it } from "vitest";

import {
  finalizeDeviceClaim,
  getInitialDeviceQrPanelState,
  resolveDeviceAuthRestore,
} from "../components/device-qr/device-panel-state";
import {
  buildDeviceActivePanelModel,
  getVisibleDevicePanelError,
  shouldResetStoredDeviceSession,
} from "../components/device-qr/device-runtime-state";
import {
  parseDeviceSession,
  serializeDeviceSession,
} from "../lib/device-auth";

describe("device qr panel state", () => {
  it("defaults to enter-code when no device session exists", () => {
    expect(getInitialDeviceQrPanelState(null)).toMatchObject({
      step: "enter-code",
      session: null,
    });
  });

  it("moves straight to active-device after a successful claim", () => {
    expect(
      finalizeDeviceClaim({
        deviceId: "device_123",
        label: "QR Device BC1234",
        claimedAt: 1_234_567_890,
      }),
    ).toMatchObject({
      step: "active-device",
      session: {
        deviceId: "device_123",
        label: "QR Device BC1234",
        claimedAt: 1_234_567_890,
      },
    });
  });

  it("serializes the visible device session and enters active-device after claim success", () => {
    const nextState = finalizeDeviceClaim({
      deviceId: "device_123",
      label: "Front Desk Tablet",
      claimedAt: 1_234_567_890,
    });

    const serialized = serializeDeviceSession(nextState.session!);
    expect(parseDeviceSession(serialized)).toEqual(nextState.session);
    expect(nextState.step).toBe("active-device");
  });

  it("returns to enter-code on invalid auth restore", () => {
    const nextState = resolveDeviceAuthRestore(
      {
        deviceId: "device_123",
        label: "Front Desk Tablet",
        claimedAt: 1_234_567_890,
      },
      false,
    );

    expect(nextState).toMatchObject({
      step: "enter-code",
      session: null,
    });
  });

  it("keeps the device session on temporary restore failures", () => {
    expect(shouldResetStoredDeviceSession(500, "INTERNAL_ERROR")).toBe(false);
    expect(shouldResetStoredDeviceSession(503, null)).toBe(false);
  });

  it("resets the device session only for explicit device unauthorized responses", () => {
    expect(shouldResetStoredDeviceSession(401, "DEVICE_UNAUTHORIZED")).toBe(true);
    expect(shouldResetStoredDeviceSession(401, "INTERNAL_ERROR")).toBe(false);
  });

  it("builds a live QR panel model once token rendering succeeds", () => {
    expect(
      buildDeviceActivePanelModel({
        isRestoring: false,
        isRefreshingToken: false,
        qrCodeDataUrl: "data:image/png;base64,qr",
        runtimeErrorMessage: null,
        secondsUntilRefresh: 12,
        tokenIssuedAt: 1_234_567_000,
      }),
    ).toMatchObject({
      statusLabel: "QR aktif",
      refreshLabel: "Refresh dalam 12 detik",
      hasLiveQr: true,
      tokenIssuedAt: 1_234_567_000,
    });
  });

  it("hides stale bootstrap errors once the panel is in active runtime mode", () => {
    expect(
      getVisibleDevicePanelError({
        step: "active-device",
        errorMessage: "Gagal memulihkan sesi device.",
        runtimeErrorMessage: null,
      }),
    ).toBeNull();
  });
});
