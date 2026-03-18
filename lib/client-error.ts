import { CLIENT_MESSAGE_BY_CODE } from "@/lib/error-catalog";

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
  if (CLIENT_MESSAGE_BY_CODE[code]) {
    return CLIENT_MESSAGE_BY_CODE[code];
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
