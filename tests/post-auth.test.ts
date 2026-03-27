import { describe, expect, it } from "vitest";

import {
  buildPostAuthContinuePath,
  getRoleHomePath,
  sanitizePostAuthNextPath,
} from "../lib/post-auth";

describe("post auth helpers", () => {
  it("maps role home paths", () => {
    expect(getRoleHomePath("karyawan")).toBe("/scan");
    expect(getRoleHomePath("admin")).toBe("/dashboard");
    expect(getRoleHomePath("superadmin")).toBe("/dashboard");
    expect(getRoleHomePath("device-qr")).toBe("/qr");
  });

  it("rejects unsafe next paths", () => {
    expect(sanitizePostAuthNextPath("https://evil.example.com")).toBeNull();
    expect(sanitizePostAuthNextPath("//evil.example.com")).toBeNull();
    expect(sanitizePostAuthNextPath("/auth/continue?next=%2Fdashboard")).toBeNull();
  });

  it("builds the continue path only from safe internal paths", () => {
    expect(buildPostAuthContinuePath("/dashboard/report?range=7d")).toBe(
      "/auth/continue?next=%2Fdashboard%2Freport%3Frange%3D7d",
    );
    expect(buildPostAuthContinuePath("https://evil.example.com")).toBe("/auth/continue");
    expect(buildPostAuthContinuePath()).toBe("/auth/continue");
  });
});
