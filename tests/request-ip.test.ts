import { describe, expect, it } from "vitest";

import { getRequestRateLimitKey, getTrustedClientIp } from "../lib/request-ip";

describe("request ip helpers", () => {
  it("prefers trusted single-ip headers", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        "x-real-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.4, 10.0.0.2",
      },
    });

    expect(getTrustedClientIp(request)).toBe("203.0.113.10");
  });

  it("uses x-forwarded-for only when a trusted proxy marker is present", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "198.51.100.4, 10.0.0.2",
        "x-vercel-id": "sin1::iad1::abc123",
      },
    });

    expect(getTrustedClientIp(request)).toBe("198.51.100.4");
  });

  it("ignores raw x-forwarded-for without a trusted proxy marker", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "198.51.100.4, 10.0.0.2",
      },
    });

    expect(getTrustedClientIp(request)).toBeNull();
  });

  it("builds a stable rate-limit key from trusted ip and user-agent", () => {
    const request = new Request("http://localhost/api/test", {
      headers: {
        "x-real-ip": "203.0.113.10",
        "user-agent": "Vitest Browser",
      },
    });

    expect(getRequestRateLimitKey(request)).toBe("ip:203.0.113.10|ua:Vitest Browser");
  });
});
