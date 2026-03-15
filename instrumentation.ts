import type { Instrumentation } from "next";

import { shouldEnableSentry } from "./lib/runtime-flags";

export async function register() {
  if (!shouldEnableSentry()) {
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  ...args
) => {
  if (!shouldEnableSentry()) {
    return;
  }

  const Sentry = await import("@sentry/nextjs");
  await Sentry.captureRequestError(...args);
};
