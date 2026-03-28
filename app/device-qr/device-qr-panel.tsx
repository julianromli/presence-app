"use client";

import { startTransition, useEffect, useState } from "react";
import QRCode from "qrcode";

import { DeviceActivePanel } from "@/components/device-qr/device-active-panel";
import { DeviceBootstrapForm } from "@/components/device-qr/device-bootstrap-form";
import {
  finalizeDeviceClaim,
  getInitialDeviceQrPanelState,
  resolveDeviceAuthRestore,
} from "@/components/device-qr/device-panel-state";
import {
  getVisibleDevicePanelError,
  getSecondsUntilRefresh,
  shouldResetStoredDeviceSession,
} from "@/components/device-qr/device-runtime-state";
import { type DeviceSession } from "@/lib/device-auth";
type DeviceWorkspacePreview = {
  workspaceId: string;
  name: string;
};

type ClaimDeviceResponse = {
  deviceId: string;
  label: string;
  claimedAt: number;
  workspace: DeviceWorkspacePreview;
};

type DeviceAuthResponse =
  | { ok: false }
  | {
      ok: true;
      device: {
        deviceId: string;
        label: string;
        claimedAt: number;
      };
      workspace: DeviceWorkspacePreview;
    };

type DeviceQrTokenResponse = {
  token: string;
  expiresAt: number;
  issuedAt: number;
  ttlMs: number;
  rotationIntervalMs: number;
  serverTime: number;
};

const DEVICE_HEARTBEAT_INTERVAL_MS = 20_000;
const DEVICE_QR_RETRY_DELAY_MS = 5_000;

async function parseErrorPayload(response: Response) {
  try {
    return (await response.json()) as { code?: string; message?: string };
  } catch {
    return {};
  }
}

async function deviceFetch(input: RequestInfo | URL, init?: RequestInit) {
  return await fetch(input, {
    ...init,
    cache: init?.cache ?? "no-store",
  });
}

function clearActivePanelRuntime(
  setQrCodeDataUrl: (value: string | null) => void,
  setTokenExpiresAt: (value: number | null) => void,
  setTokenIssuedAt: (value: number | null) => void,
  setRuntimeErrorMessage: (value: string | null) => void,
  setErrorMessage: (value: string | null) => void,
  setWorkspace: (value: DeviceWorkspacePreview | null) => void,
  nextErrorMessage: string | null,
) {
  setQrCodeDataUrl(null);
  setTokenExpiresAt(null);
  setTokenIssuedAt(null);
  setRuntimeErrorMessage(null);
  setErrorMessage(nextErrorMessage);
  setWorkspace(null);
}

export function DeviceQrPanel() {
  const [panelState, setPanelState] = useState(() =>
    getInitialDeviceQrPanelState(null),
  );
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [isResettingPairing, setIsResettingPairing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [runtimeErrorMessage, setRuntimeErrorMessage] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [tokenIssuedAt, setTokenIssuedAt] = useState<number | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number | null>(null);
  const [workspace, setWorkspace] = useState<DeviceWorkspacePreview | null>(null);

  useEffect(() => {
    let active = true;

    const restore = async () => {
      if (!active) {
        return;
      }

      try {
        const response = await deviceFetch("/api/device/auth");

        if (!response.ok) {
          const payload = await parseErrorPayload(response);
          const shouldReset = shouldResetStoredDeviceSession(
            response.status,
            payload.code ?? null,
          );
          if (!active) {
            return;
          }
          setPanelState(resolveDeviceAuthRestore(null, false));
          setWorkspace(null);
          setErrorMessage(
            shouldReset
              ? "Sesi device tidak valid lagi. Masukkan code baru untuk pairing ulang."
              : payload.message ?? "Gagal memulihkan sesi device. Runtime akan mencoba lagi.",
          );
          return;
        }

        const payload = (await response.json()) as DeviceAuthResponse;
        if (!payload.ok) {
          if (!active) {
            return;
          }
          setPanelState(resolveDeviceAuthRestore(null, false));
          setWorkspace(null);
          setErrorMessage(null);
          setRuntimeErrorMessage(null);
          return;
        }

        const restoredSession: DeviceSession = {
          deviceId: payload.device.deviceId,
          label: payload.device.label,
          claimedAt: payload.device.claimedAt,
        };
        if (!active) {
          return;
        }
        setPanelState(resolveDeviceAuthRestore(restoredSession, true));
        setWorkspace(payload.workspace);
        setErrorMessage(null);
        setRuntimeErrorMessage(null);
      } catch {
        if (!active) {
          return;
        }
        setPanelState(resolveDeviceAuthRestore(null, false));
        setWorkspace(null);
        setErrorMessage("Gagal memulihkan sesi device. Runtime akan mencoba lagi.");
      } finally {
        if (active) {
          setIsRestoring(false);
        }
      }
    };

    void restore();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!tokenExpiresAt) {
      setSecondsUntilRefresh(null);
      return;
    }

    setSecondsUntilRefresh(getSecondsUntilRefresh(tokenExpiresAt));
    const intervalId = window.setInterval(() => {
      setSecondsUntilRefresh(getSecondsUntilRefresh(tokenExpiresAt));
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [tokenExpiresAt]);

  useEffect(() => {
    if (
      panelState.step !== "active-device" ||
      !panelState.session ||
      isRestoring
    ) {
      return;
    }

    let active = true;
    let refreshTimeoutId: number | null = null;
    let heartbeatIntervalId: number | null = null;

    const resetToBootstrap = (message: string) => {
      clearActivePanelRuntime(
        setQrCodeDataUrl,
        setTokenExpiresAt,
        setTokenIssuedAt,
        setRuntimeErrorMessage,
        setErrorMessage,
        setWorkspace,
        message,
      );
      startTransition(() => {
        setPanelState(getInitialDeviceQrPanelState(null));
      });
    };

    const scheduleNextRefresh = (delayMs: number) => {
      if (!active) {
        return;
      }

      if (refreshTimeoutId) {
        window.clearTimeout(refreshTimeoutId);
      }

      refreshTimeoutId = window.setTimeout(() => {
        void refreshQrToken();
      }, delayMs);
    };

    const sendHeartbeat = async () => {
      try {
        const response = await deviceFetch("/api/device/ping");

        if (!response.ok) {
          const payload = await parseErrorPayload(response);
          if (
            shouldResetStoredDeviceSession(
              response.status,
              payload.code ?? null,
            )
          ) {
            resetToBootstrap("Device ini sudah tidak valid. Masukkan code baru untuk pairing ulang.");
            return;
          }

          setRuntimeErrorMessage(
            payload.message ?? "Heartbeat device gagal sementara. Runtime akan mencoba lagi.",
          );
          return;
        }

        setRuntimeErrorMessage(null);
      } catch {
        setRuntimeErrorMessage("Heartbeat device gagal sementara. Runtime akan mencoba lagi.");
      }
    };

    const refreshQrToken = async () => {
      setIsRefreshingToken(true);

      try {
        const response = await deviceFetch("/api/device/qr-token");

        if (!response.ok) {
          const payload = await parseErrorPayload(response);
          if (
            shouldResetStoredDeviceSession(
              response.status,
              payload.code ?? null,
            )
          ) {
            resetToBootstrap("Device ini sudah tidak valid. Masukkan code baru untuk pairing ulang.");
            return;
          }

          setRuntimeErrorMessage(
            payload.message ?? "Gagal membuat QR token. Runtime akan mencoba lagi.",
          );
          scheduleNextRefresh(DEVICE_QR_RETRY_DELAY_MS);
          return;
        }

        const payload = (await response.json()) as DeviceQrTokenResponse;
        const qrDataUrl = await QRCode.toDataURL(payload.token, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 360,
        });

        if (!active) {
          return;
        }

        setQrCodeDataUrl(qrDataUrl);
        setTokenExpiresAt(payload.expiresAt);
        setTokenIssuedAt(payload.issuedAt);
        setRuntimeErrorMessage(null);
        scheduleNextRefresh(Math.max(1_000, payload.rotationIntervalMs));
      } catch {
        if (!active) {
          return;
        }
        setRuntimeErrorMessage("Gagal membuat QR token. Runtime akan mencoba lagi.");
        scheduleNextRefresh(DEVICE_QR_RETRY_DELAY_MS);
      } finally {
        if (active) {
          setIsRefreshingToken(false);
        }
      }
    };

    void refreshQrToken();
    void sendHeartbeat();
    heartbeatIntervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, DEVICE_HEARTBEAT_INTERVAL_MS);

    return () => {
      active = false;
      if (refreshTimeoutId) {
        window.clearTimeout(refreshTimeoutId);
      }
      if (heartbeatIntervalId) {
        window.clearInterval(heartbeatIntervalId);
      }
    };
  }, [isRestoring, panelState]);

  async function handleClaimDevice() {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setErrorMessage("Registration code wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await deviceFetch("/api/device/bootstrap/claim", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: trimmedCode }),
      });
      const payload = (await response.json()) as
        | ClaimDeviceResponse
        | { code?: string; message?: string };

      if (!response.ok || !("deviceId" in payload)) {
        setErrorMessage(
          "message" in payload && payload.message
            ? payload.message
            : "Gagal mengaktifkan device.",
        );
        return;
      }

      const session: DeviceSession = {
        deviceId: payload.deviceId,
        label: payload.label,
        claimedAt: payload.claimedAt,
      };
      setWorkspace(payload.workspace);
      setErrorMessage(null);
      setRuntimeErrorMessage(null);
      setPanelState(finalizeDeviceClaim(session));
    } catch {
      setErrorMessage("Gagal mengaktifkan device.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPairing() {
    setIsResettingPairing(true);

    try {
      await deviceFetch("/api/device/auth", {
        method: "DELETE",
      });
      clearActivePanelRuntime(
        setQrCodeDataUrl,
        setTokenExpiresAt,
        setTokenIssuedAt,
        setRuntimeErrorMessage,
        setErrorMessage,
        setWorkspace,
        null,
      );
      setCode("");
      startTransition(() => {
        setPanelState(getInitialDeviceQrPanelState(null));
      });
    } catch {
      setRuntimeErrorMessage("Gagal menghapus pairing device. Coba lagi.");
    } finally {
      setIsResettingPairing(false);
    }
  }

  return (
    <div className="container flex min-h-[80vh] items-center justify-center py-10">
      {panelState.step === "active-device" && panelState.session ? (
        <DeviceActivePanel
          isRefreshingToken={isRefreshingToken}
          isRestoring={isRestoring}
          isResettingPairing={isResettingPairing}
          onResetPairing={() => void handleResetPairing()}
          qrCodeDataUrl={qrCodeDataUrl}
          runtimeErrorMessage={getVisibleDevicePanelError({
            step: panelState.step,
            errorMessage,
            runtimeErrorMessage,
          })}
          secondsUntilRefresh={secondsUntilRefresh}
          session={panelState.session}
          tokenIssuedAt={tokenIssuedAt}
          workspaceLabel={workspace?.name ?? workspace?.workspaceId ?? null}
        />
      ) : (
        <DeviceBootstrapForm
          code={code}
          errorMessage={errorMessage}
          isSubmitting={isSubmitting}
          onCodeChange={setCode}
          onSubmit={handleClaimDevice}
        />
      )}
    </div>
  );
}
