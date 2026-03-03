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
  BAD_REQUEST: 'Permintaan tidak valid.',
  NOT_FOUND: 'Data yang diminta tidak ditemukan.',
  WRITE_CONFLICT: 'Terjadi konflik data. Silakan coba lagi.',
  SPAM_DETECTED: 'Aksi terlalu cepat. Tunggu sebentar lalu coba lagi.',
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
