import { beforeEach, describe, expect, it, vi } from "vitest";

function redirectError(path: string) {
  return new Error(`REDIRECT:${path}`);
}

async function setupPageTest(options?: {
  userId?: string | null;
  token?: string | null;
  syncResponse?: Response | null;
}) {
  vi.resetModules();

  const ensureCurrentUserInConvex = vi.fn(async () =>
    options?.syncResponse === undefined ? null : options.syncResponse,
  );
  const redirect = vi.fn((path: string) => {
    throw redirectError(path);
  });

  vi.doMock("@clerk/nextjs/server", () => ({
    auth: vi.fn(async () => ({
      userId: options?.userId === undefined ? "clerk_u1" : options.userId,
    })),
  }));
  vi.doMock("@/lib/auth", () => ({
    getConvexTokenOrNull: vi.fn(async () =>
      options?.token === undefined ? "convex-token" : options.token,
    ),
  }));
  vi.doMock("@/lib/user-sync", () => ({ ensureCurrentUserInConvex }));
  vi.doMock("next/navigation", () => ({ redirect }));
  vi.doMock("@clerk/nextjs", () => ({
    SignedIn: ({ children }: { children: React.ReactNode }) => children,
    SignedOut: ({ children }: { children: React.ReactNode }) => children,
    SignIn: () => null,
    SignUp: () => null,
    UserButton: () => null,
  }));
  vi.doMock("next/link", () => ({
    default: ({ children }: { children: React.ReactNode }) => children,
  }));
  vi.doMock("@/components/ui/button", () => ({
    Button: ({ children }: { children: React.ReactNode }) => children,
  }));
  vi.doMock("@/components/auth/auth-page-shell", () => ({
    AuthPageShell: ({ children }: { children: React.ReactNode }) => children,
  }));

  const signInPage = await import("../app/(auth)/sign-in/[[...sign-in]]/page");
  const signUpPage = await import("../app/(auth)/sign-up/[[...sign-up]]/page");

  return {
    signInPage,
    signUpPage,
    mocks: { ensureCurrentUserInConvex, redirect },
  };
}

describe("auth pages redirect", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects signed-in visitors from sign-in to onboarding after ensuring Convex user", async () => {
    const { signInPage, mocks } = await setupPageTest();

    await expect(Promise.resolve().then(() => signInPage.default())).rejects.toThrow(
      "REDIRECT:/onboarding/workspace",
    );
    expect(mocks.ensureCurrentUserInConvex).toHaveBeenCalledWith("convex-token");
    expect(mocks.redirect).toHaveBeenCalledWith("/onboarding/workspace");
  });

  it("redirects signed-in visitors from sign-up to onboarding after ensuring Convex user", async () => {
    const { signUpPage, mocks } = await setupPageTest();

    await expect(Promise.resolve().then(() => signUpPage.default())).rejects.toThrow(
      "REDIRECT:/onboarding/workspace",
    );
    expect(mocks.ensureCurrentUserInConvex).toHaveBeenCalledWith("convex-token");
    expect(mocks.redirect).toHaveBeenCalledWith("/onboarding/workspace");
  });
});
