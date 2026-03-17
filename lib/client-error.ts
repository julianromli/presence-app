export type ApiErrorInfo = {
  code: string;
  message: string;
  status: number;
};

const FALLBACK_CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'WRITE_CONFLICT',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};

const MESSAGE_BY_CODE: Record<string, string> = {
  UNAUTHENTICATED: 'Sesi login berakhir. Silakan login ulang.',
  FORBIDDEN: 'Anda tidak memiliki izin untuk aksi ini.',
  USER_NOT_FOUND: 'Data user tidak ditemukan. Silakan sinkronisasi ulang akun.',
  INACTIVE_USER: 'Akun Anda tidak aktif. Hubungi superadmin.',
  VALIDATION_ERROR: 'Input tidak valid. Periksa lagi data yang dimasukkan.',
  WORKSPACE_REQUIRED: 'Workspace aktif belum dipilih. Pilih workspace terlebih dahulu.',
  WORKSPACE_INVALID: 'Workspace aktif tidak valid. Pilih ulang workspace Anda.',
  BAD_REQUEST: 'Permintaan tidak valid.',
  NOT_FOUND: 'Data yang diminta tidak ditemukan.',
  WRITE_CONFLICT: 'Terjadi konflik data. Silakan coba lagi.',
  SPAM_DETECTED: 'Aksi terlalu cepat. Tunggu sebentar lalu coba lagi.',
  DEVICE_HEARTBEAT_STALE: 'Perangkat QR sedang offline. Minta petugas menyegarkan perangkat QR.',
  GEOFENCE_NOT_CONFIGURED:
    'Area absensi kantor belum dikonfigurasi dengan benar. Hubungi admin workspace.',
  GEOFENCE_ACCURACY_REQUIRED:
    'Izin lokasi dan akurasi GPS diperlukan untuk scan di area kantor.',
  GEOFENCE_ACCURACY_TOO_LOW:
    'Akurasi GPS Anda belum cukup. Dekatkan diri ke area terbuka lalu coba lagi.',
  INTERNAL_ERROR: 'Terjadi gangguan sistem. Coba lagi beberapa saat.',
};

function fallbackCodeFromStatus(status: number) {
  if (FALLBACK_CODE_BY_STATUS[status]) {
    return FALLBACK_CODE_BY_STATUS[status];
  }
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'UNKNOWN_ERROR';
}

function pickString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeMessage(code: string, rawMessage: string | null, fallbackMessage: string) {
  if (MESSAGE_BY_CODE[code]) {
    return MESSAGE_BY_CODE[code];
  }
  if (rawMessage) {
    return rawMessage;
  }
  return fallbackMessage;
}

export async function parseApiErrorResponse(response: Response, fallbackMessage: string) {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const data =
    typeof payload === 'object' && payload !== null
      ? (payload as { code?: unknown; message?: unknown })
      : null;
  const code = pickString(data?.code) ?? fallbackCodeFromStatus(response.status);
  const rawMessage = pickString(data?.message);
  const message = normalizeMessage(code, rawMessage, fallbackMessage);

  return {
    code,
    message,
    status: response.status,
  } satisfies ApiErrorInfo;
}

export async function normalizeClientError(
  error: unknown,
  fallbackMessage: string,
): Promise<ApiErrorInfo> {
  if (error instanceof Response) {
    return parseApiErrorResponse(error, fallbackMessage);
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'status' in error
  ) {
    const candidate = error as Partial<ApiErrorInfo>;
    if (
      typeof candidate.code === 'string' &&
      typeof candidate.message === 'string' &&
      typeof candidate.status === 'number'
    ) {
      const normalizedMessage = pickString(candidate.message) ?? fallbackMessage;
      return {
        code: candidate.code,
        message: normalizedMessage,
        status: candidate.status,
      };
    }
  }

  const rawMessage =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : fallbackMessage;

  return {
    code: 'INTERNAL_ERROR',
    message: rawMessage,
    status: 500,
  };
}
