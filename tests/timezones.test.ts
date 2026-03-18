import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("timezone validation cache", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("caches valid timezones", async () => {
    const { isValidTimeZone } = await import("../lib/timezones");
    const spy = vi.spyOn(Intl, "DateTimeFormat");

    expect(isValidTimeZone("Asia/Jakarta")).toBe(true);
    expect(isValidTimeZone("Asia/Jakarta")).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does not cache invalid timezone strings", async () => {
    const { isValidTimeZone } = await import("../lib/timezones");
    const spy = vi.spyOn(Intl, "DateTimeFormat");

    expect(isValidTimeZone("Invalid/Timezone")).toBe(false);
    expect(isValidTimeZone("Invalid/Timezone")).toBe(false);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
