import { beforeEach, describe, expect, it, vi } from "vitest";

function redirectError(path: string) {
  return new Error(`REDIRECT:${path}`);
}

async function setupPageTest(options?: {
  userId?: string | null;
  role?: "superadmin" | "admin" | "karyawan" | "device-qr";
  token?: string | null;
}) {
  vi.resetModules();

  const ensureCurrentUserInConvex = vi.fn(async () => null);
  const requireWorkspaceRolePageFromDb = vi.fn(async () => ({
    role: options?.role ?? "admin",
    user: {
      name: "Faiz",
      email: "faiz@example.com",
    },
    workspace: {
      _id: "workspace_123456",
      name: "Acme Workspace",
    },
  }));
  const redirect = vi.fn((path: string) => {
    throw redirectError(path);
  });

  vi.doMock("@clerk/nextjs/server", () => ({
    auth: vi.fn(async () => ({
      userId: options?.userId === undefined ? "clerk_u1" : options.userId,
    })),
  }));
  vi.doMock("@/lib/auth", async () => {
    return {
      APP_ROLES: ["superadmin", "admin", "karyawan", "device-qr"],
      getConvexTokenOrNull: vi.fn(async () =>
        options?.token === undefined ? "convex-token" : options.token,
      ),
      requireWorkspaceRolePageFromDb,
    };
  });
  vi.doMock("@/lib/user-sync", () => ({ ensureCurrentUserInConvex }));
  vi.doMock("next/navigation", () => ({ redirect }));

  const pageModule = await import("../app/auth/continue/page");
  return {
    pageModule,
    mocks: { ensureCurrentUserInConvex, requireWorkspaceRolePageFromDb, redirect },
  };
}

describe("auth continue page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("routes karyawan users to /scan", async () => {
    const { pageModule, mocks } = await setupPageTest({ role: "karyawan" });

    await expect(
      Promise.resolve().then(() =>
        pageModule.default({
          searchParams: Promise.resolve({ next: "/dashboard/report" }),
        }),
      ),
    ).rejects.toThrow("REDIRECT:/scan");

    expect(mocks.ensureCurrentUserInConvex).toHaveBeenCalledWith("convex-token");
    expect(mocks.requireWorkspaceRolePageFromDb).toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/scan");
  });

  it("preserves safe internal next paths for admin roles", async () => {
    const { pageModule, mocks } = await setupPageTest({ role: "admin" });

    await expect(
      Promise.resolve().then(() =>
        pageModule.default({
          searchParams: Promise.resolve({ next: "/dashboard/report?range=this-week" }),
        }),
      ),
    ).rejects.toThrow("REDIRECT:/dashboard/report?range=this-week");

    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/report?range=this-week");
  });

  it("falls back to the role home path when next is unsafe", async () => {
    const { pageModule, mocks } = await setupPageTest({ role: "superadmin" });

    await expect(
      Promise.resolve().then(() =>
        pageModule.default({
          searchParams: Promise.resolve({ next: "https://evil.example.com/pwn" }),
        }),
      ),
    ).rejects.toThrow("REDIRECT:/dashboard");

    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });
});
