import { describe, expect, it } from "vitest";

import { parseApiErrorResponse } from "../lib/client-error";

describe("parseApiErrorResponse", () => {
  it("replaces invalid workspace plan limit key debug text with a client-safe message", async () => {
    const response = Response.json(
      {
        code: "WORKSPACE_PLAN_LIMIT_KEY_INVALID",
        message:
          'WORKSPACE_PLAN_LIMIT_KEY_INVALID: Unknown workspace plan limit key "maxUsersPerWorkspace".',
      },
      { status: 400 },
    );

    await expect(
      parseApiErrorResponse(response, "Terjadi kesalahan."),
    ).resolves.toEqual({
      code: "WORKSPACE_PLAN_LIMIT_KEY_INVALID",
      message:
        "Konfigurasi batas paket workspace sedang bermasalah. Hubungi tim support.",
      status: 400,
    });
  });

  it("replaces invalid workspace feature key debug text with a client-safe message", async () => {
    const response = Response.json(
      {
        code: "WORKSPACE_PLAN_FEATURE_KEY_INVALID",
        message:
          'WORKSPACE_PLAN_FEATURE_KEY_INVALID: Unknown workspace plan feature key "customBranding".',
      },
      { status: 400 },
    );

    await expect(
      parseApiErrorResponse(response, "Terjadi kesalahan."),
    ).resolves.toEqual({
      code: "WORKSPACE_PLAN_FEATURE_KEY_INVALID",
      message:
        "Konfigurasi fitur paket workspace sedang bermasalah. Hubungi tim support.",
      status: 400,
    });
  });
});
