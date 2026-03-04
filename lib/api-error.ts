import { ConvexError } from "convex/values";

type ConvexErrorData = {
  code?: string;
  message?: string;
};

const STATUS_BY_CODE: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INACTIVE_USER: 403,
  USER_NOT_FOUND: 404,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  TOKEN_UNKNOWN: 400,
  TOKEN_EXPIRED: 400,
  TOKEN_REPLAY: 409,
  INVALID_TOKEN_FOR_DEVICE: 403,
  GEOFENCE_COORD_REQUIRED: 400,
  GEOFENCE_OUTSIDE_RADIUS: 403,
  IP_NOT_ALLOWED: 403,
  SPAM_DETECTED: 429,
  DEVICE_HEARTBEAT_STALE: 403,
  WRITE_CONFLICT: 409,
  SETTINGS_NOT_INITIALIZED: 503,
  WORKSPACE_REQUIRED: 400,
  WORKSPACE_INVALID: 400,
  CODE_NOT_FOUND: 400,
  CODE_INACTIVE: 400,
  CODE_EXPIRED: 400,
  ALREADY_MEMBER: 409,
};

function toConvexErrorData(error: unknown): ConvexErrorData | null {
  if (
    error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data !== null
  ) {
    const data = error.data as ConvexErrorData;
    return data;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof (error as { data?: unknown }).data === "object" &&
    (error as { data?: unknown }).data !== null
  ) {
    return (error as { data: ConvexErrorData }).data;
  }

  return null;
}

function toWriteConflictResponse() {
  return Response.json(
    {
      code: "WRITE_CONFLICT",
      message: "Terjadi konflik data. Silakan ulangi aksi.",
    },
    { status: 409 },
  );
}

export function convexErrorResponse(error: unknown, fallbackMessage: string) {
  const convexData = toConvexErrorData(error);
  if (convexData?.code || convexData?.message) {
    const code = convexData.code ?? "CONVEX_ERROR";
    const message = convexData.message ?? fallbackMessage;
    const status = STATUS_BY_CODE[code] ?? 400;
    return Response.json({ code, message }, { status });
  }

  if (error instanceof Error && /write conflict/i.test(error.message)) {
    return toWriteConflictResponse();
  }

  if (error instanceof Error && /forbidden/i.test(error.message)) {
    return Response.json(
      { code: "FORBIDDEN", message: "Forbidden" },
      { status: 403 },
    );
  }

  return Response.json(
    {
      code: "INTERNAL_ERROR",
      message: fallbackMessage,
    },
    { status: 500 },
  );
}
