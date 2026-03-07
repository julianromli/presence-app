export type DeviceActivePanelModel = {
  hasLiveQr: boolean;
  qrImageAlt: string;
  refreshLabel: string;
  runtimeMessage: string;
  statusLabel: string;
  tokenIssuedAt: number | null;
};

export function shouldResetStoredDeviceSession(
  status: number | null | undefined,
  errorCode: string | null | undefined,
) {
  return status === 401 && errorCode === "DEVICE_UNAUTHORIZED";
}

export function getVisibleDevicePanelError({
  step,
  errorMessage,
  runtimeErrorMessage,
}: {
  step: "enter-code" | "name-device" | "active-device";
  errorMessage: string | null;
  runtimeErrorMessage: string | null;
}) {
  if (step === "active-device") {
    return runtimeErrorMessage;
  }

  return errorMessage;
}

export function getSecondsUntilRefresh(
  expiresAt: number | null | undefined,
  now = Date.now(),
) {
  if (!expiresAt) {
    return null;
  }

  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

export function buildDeviceActivePanelModel({
  isRestoring,
  isRefreshingToken,
  qrCodeDataUrl,
  runtimeErrorMessage,
  secondsUntilRefresh,
  tokenIssuedAt,
}: {
  isRestoring: boolean;
  isRefreshingToken: boolean;
  qrCodeDataUrl: string | null;
  runtimeErrorMessage: string | null;
  secondsUntilRefresh: number | null;
  tokenIssuedAt: number | null;
}): DeviceActivePanelModel {
  if (isRestoring) {
    return {
      hasLiveQr: false,
      qrImageAlt: "QR device sedang dipulihkan",
      refreshLabel: "Memulihkan sesi device...",
      runtimeMessage: "Kredensial device sedang diverifikasi sebelum QR diaktifkan.",
      statusLabel: "Memulihkan sesi...",
      tokenIssuedAt,
    };
  }

  if (runtimeErrorMessage) {
    return {
      hasLiveQr: false,
      qrImageAlt: "QR device belum tersedia",
      refreshLabel: "Menunggu retry runtime",
      runtimeMessage: runtimeErrorMessage,
      statusLabel: "Perlu perhatian",
      tokenIssuedAt,
    };
  }

  if (qrCodeDataUrl) {
    return {
      hasLiveQr: true,
      qrImageAlt: "QR aktif untuk presensi",
      refreshLabel:
        secondsUntilRefresh === null
          ? "Refresh otomatis aktif"
          : `Refresh dalam ${secondsUntilRefresh} detik`,
      runtimeMessage: isRefreshingToken
        ? "Menyiapkan token QR berikutnya di background."
        : "QR aktif dan siap dipindai dari layar ini.",
      statusLabel: "QR aktif",
      tokenIssuedAt,
    };
  }

  return {
    hasLiveQr: false,
    qrImageAlt: "QR device sedang disiapkan",
    refreshLabel: "Membuat token QR pertama",
    runtimeMessage: isRefreshingToken
      ? "Membuat token QR pertama untuk device ini."
      : "Menunggu token QR pertama tersedia.",
    statusLabel: isRefreshingToken ? "Menyiapkan QR..." : "Menunggu runtime",
    tokenIssuedAt,
  };
}
