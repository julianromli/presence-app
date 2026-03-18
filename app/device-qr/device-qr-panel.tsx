"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { DeviceActivePanel } from "@/components/device-qr/device-active-panel";
import { DeviceBootstrapForm } from "@/components/device-qr/device-bootstrap-form";
import {
  advanceToDeviceNaming,
  finalizeDeviceClaim,
  getInitialDeviceQrPanelState,
  resolveDeviceAuthRestore,
} from "@/components/device-qr/device-panel-state";
import {
  getVisibleDevicePanelError,
  getSecondsUntilRefresh,
  shouldResetStoredDeviceSession,
} from "@/components/device-qr/device-runtime-state";
import {
  buildDeviceRequestHeaders,
  type DeviceSession,
} from "@/lib/device-auth";
import {
  getActiveWorkspaceIdFromBrowser,
  setActiveWorkspaceIdInBrowser,
  workspaceFetch,
} from "@/lib/workspace-client";

type ValidateCodeResponse = {
  ok: boolean;
  message?: string;
};

type ClaimDeviceResponse = {
  deviceId: string;
  label: string;
  claimedAt: number;
};

type DeviceAuthResponse = {
  ok: true;
  device: {
    deviceId: string;
    label: string;
    claimedAt: number;
  };
};

type DeviceQrTokenResponse = {
  token: string;
  expiresAt: number;
  issuedAt: number;
  ttlMs: number;
  rotationIntervalMs: number;
  serverTime: number;
};

type DeviceWorkspacePreview = {
  workspaceId: string;
  name: string;
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

type DeviceQrPanelProps = {
  initialWorkspaceId?: string | null;
};

export function DeviceQrPanel({ initialWorkspaceId = null }: DeviceQrPanelProps) {
  const [panelState, setPanelState] = useState(() =>
    getInitialDeviceQrPanelState(null),
  );
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [runtimeErrorMessage, setRuntimeErrorMessage] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [tokenIssuedAt, setTokenIssuedAt] = useState<number | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number | null>(null);
  const [resolvedWorkspaceId, setResolvedWorkspaceId] = useState<string | null>(() =>
    initialWorkspaceId ?? getActiveWorkspaceIdFromBrowser(),
  );
  const [resolvedWorkspaceName, setResolvedWorkspaceName] = useState<string | null>(null);

  useEffect(() => {
    if (!initialWorkspaceId) {
      return;
    }

    setResolvedWorkspaceId(initialWorkspaceId);
    setActiveWorkspaceIdInBrowser(initialWorkspaceId);
  }, [initialWorkspaceId]);

  useEffect(() => {
    let active = true;

    const loadWorkspaceName = async () => {
      if (!resolvedWorkspaceId) {
        setResolvedWorkspaceName(null);
        return;
      }

      try {
        const response = await workspaceFetch("/api/device/workspace", {
          cache: "no-store",
          headers: {
            ...buildDeviceRequestHeaders({
              workspaceId: resolvedWorkspaceId,
            }),
          },
        });

        if (!response.ok) {
          if (active) {
            setResolvedWorkspaceName(null);
          }
          return;
        }

        const payload = (await response.json()) as DeviceWorkspacePreview;
        if (active) {
          setResolvedWorkspaceName(payload.name);
        }
      } catch {
        if (active) {
          setResolvedWorkspaceName(null);
        }
      }
    };

    void loadWorkspaceName();

    return () => {
      active = false;
    };
  }, [resolvedWorkspaceId]);

  useEffect(() => {
    let active = true;

    const restore = async () => {
      if (!resolvedWorkspaceId) {
        setPanelState(getInitialDeviceQrPanelState(null));
        setIsRestoring(false);
        return;
      }

      if (!active) {
        return;
      }

      try {
        const response = await workspaceFetch("/api/device/auth", {
          cache: "no-store",
          headers: {
            ...buildDeviceRequestHeaders({
              workspaceId: resolvedWorkspaceId,
            }),
          },
        });

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
          setErrorMessage(
            shouldReset
              ? "Sesi device tidak valid lagi. Masukkan code baru untuk pairing ulang."
              : payload.message ?? "Gagal memulihkan sesi device. Runtime akan mencoba lagi.",
          );
          return;
        }

        const payload = (await response.json()) as DeviceAuthResponse;
        const restoredSession: DeviceSession = {
          deviceId: payload.device.deviceId,
          label: payload.device.label,
          claimedAt: payload.device.claimedAt,
        };
        if (!active) {
          return;
        }
        setPanelState(resolveDeviceAuthRestore(restoredSession, true));
        setErrorMessage(null);
        setRuntimeErrorMessage(null);
      } catch {
        if (!active) {
          return;
        }
        setPanelState(resolveDeviceAuthRestore(null, false));
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
  }, [resolvedWorkspaceId]);

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
      setQrCodeDataUrl(null);
      setTokenExpiresAt(null);
      setTokenIssuedAt(null);
      setRuntimeErrorMessage(null);
      setErrorMessage(message);
      setPanelState(getInitialDeviceQrPanelState(null));
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
        const response = await workspaceFetch("/api/device/ping", {
          cache: "no-store",
          headers: {
            ...buildDeviceRequestHeaders({
              workspaceId: resolvedWorkspaceId,
            }),
          },
        });

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
        const response = await workspaceFetch("/api/device/qr-token", {
          cache: "no-store",
          headers: {
            ...buildDeviceRequestHeaders({
              workspaceId: resolvedWorkspaceId,
            }),
          },
        });

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
  }, [isRestoring, panelState, resolvedWorkspaceId]);

  async function handleValidateCode() {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setErrorMessage("Registration code wajib diisi.");
      return;
    }

    if (!resolvedWorkspaceId) {
      setErrorMessage("Workspace belum ditentukan. Gunakan setup URL dari dashboard superadmin.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await workspaceFetch("/api/device/bootstrap/validate-code", {
        method: "POST",
        headers: {
          ...buildDeviceRequestHeaders({
            workspaceId: resolvedWorkspaceId,
            contentType: "application/json",
          }),
        },
        body: JSON.stringify({ code: trimmedCode }),
      });
      const payload = (await response.json()) as ValidateCodeResponse;

      if (!response.ok || !payload.ok) {
        setErrorMessage(payload.message ?? "Kode tidak valid atau sudah tidak aktif.");
        return;
      }

      setCode(trimmedCode);
      setPanelState(advanceToDeviceNaming(trimmedCode));
    } catch {
      setErrorMessage("Gagal memvalidasi registration code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleClaimDevice() {
    const trimmedLabel = label.trim();
    if (!panelState.pendingCode) {
      setPanelState(getInitialDeviceQrPanelState(null));
      setErrorMessage("Registration code tidak ditemukan. Ulangi proses dari awal.");
      return;
    }

    if (!trimmedLabel) {
      setErrorMessage("Nama device wajib diisi.");
      return;
    }

    if (!resolvedWorkspaceId) {
      setErrorMessage("Workspace belum ditentukan. Gunakan setup URL dari dashboard superadmin.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await workspaceFetch("/api/device/bootstrap/claim", {
        method: "POST",
        headers: {
          ...buildDeviceRequestHeaders({
            workspaceId: resolvedWorkspaceId,
            contentType: "application/json",
          }),
        },
        body: JSON.stringify({
          code: panelState.pendingCode,
          label: trimmedLabel,
        }),
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
      setActiveWorkspaceIdInBrowser(resolvedWorkspaceId);
      setLabel("");
      setErrorMessage(null);
      setRuntimeErrorMessage(null);
      setPanelState(finalizeDeviceClaim(session));
    } catch {
      setErrorMessage("Gagal mengaktifkan device.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBackToCodeEntry() {
    setErrorMessage(null);
    setLabel("");
    setQrCodeDataUrl(null);
    setRuntimeErrorMessage(null);
    setTokenExpiresAt(null);
    setTokenIssuedAt(null);
    setPanelState(getInitialDeviceQrPanelState(null));
  }

  return (
    <div className="container flex min-h-[80vh] items-center justify-center py-10">
      {panelState.step === "active-device" && panelState.session ? (
        <DeviceActivePanel
          isRefreshingToken={isRefreshingToken}
          isRestoring={isRestoring}
          qrCodeDataUrl={qrCodeDataUrl}
          runtimeErrorMessage={getVisibleDevicePanelError({
            step: panelState.step,
            errorMessage,
            runtimeErrorMessage,
          })}
          secondsUntilRefresh={secondsUntilRefresh}
          session={panelState.session}
          tokenIssuedAt={tokenIssuedAt}
          workspaceId={resolvedWorkspaceName ?? resolvedWorkspaceId}
        />
      ) : (
        <DeviceBootstrapForm
          code={code}
          errorMessage={errorMessage}
          isSubmitting={isSubmitting}
          label={label}
          onBack={handleBackToCodeEntry}
          onCodeChange={setCode}
          onLabelChange={setLabel}
          onSubmit={
            panelState.step === "name-device"
              ? handleClaimDevice
              : handleValidateCode
          }
          step={panelState.step === "name-device" ? "name-device" : "enter-code"}
          workspaceId={resolvedWorkspaceName ?? resolvedWorkspaceId}
        />
      )}
    </div>
  );
}
