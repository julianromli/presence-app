import { describe, expect, it } from "vitest";

import {
  shouldEnableSentry,
  shouldLoadReactGrabScripts,
  shouldUseLightweightMarketingHome,
} from "@/lib/runtime-flags";

describe("runtime flags", () => {
  it("disables Sentry by default in development", () => {
    expect(shouldEnableSentry({ nodeEnv: "development" })).toBe(false);
  });

  it("enables Sentry by default in production", () => {
    expect(shouldEnableSentry({ nodeEnv: "production" })).toBe(true);
  });

  it("allows explicit Sentry opt-in in development", () => {
    expect(
      shouldEnableSentry({
        nodeEnv: "development",
        sentryFlag: "true",
      }),
    ).toBe(true);
  });

  it("allows explicit Sentry opt-out in production", () => {
    expect(
      shouldEnableSentry({
        nodeEnv: "production",
        sentryFlag: "false",
      }),
    ).toBe(false);
  });

  it("keeps react-grab scripts off unless explicitly enabled in development", () => {
    expect(
      shouldLoadReactGrabScripts({
        nodeEnv: "development",
      }),
    ).toBe(false);
  });

  it("loads react-grab scripts only when the dev flag is enabled", () => {
    expect(
      shouldLoadReactGrabScripts({
        nodeEnv: "development",
        reactGrabFlag: "on",
      }),
    ).toBe(true);
  });

  it("never loads react-grab scripts outside development", () => {
    expect(
      shouldLoadReactGrabScripts({
        nodeEnv: "production",
        reactGrabFlag: "true",
      }),
    ).toBe(false);
  });

  it("uses the lightweight marketing home by default in development", () => {
    expect(
      shouldUseLightweightMarketingHome({
        nodeEnv: "development",
      }),
    ).toBe(true);
  });

  it("allows opting back into the full marketing home in development", () => {
    expect(
      shouldUseLightweightMarketingHome({
        nodeEnv: "development",
        fullMarketingHomeFlag: "true",
      }),
    ).toBe(false);
  });

  it("never uses the lightweight marketing home in production", () => {
    expect(
      shouldUseLightweightMarketingHome({
        nodeEnv: "production",
      }),
    ).toBe(false);
  });
});
