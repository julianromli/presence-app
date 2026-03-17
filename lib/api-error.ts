import { ConvexError } from "convex/values";

import { ERROR_STATUS_BY_CODE } from "@/lib/error-catalog";

type ConvexErrorData = {
  code?: string;
  message?: string;
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
    const status = ERROR_STATUS_BY_CODE[code] ?? 400;
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
