import { beforeEach, describe, expect, it, vi } from "vitest";

type ProxyHandler = (
  auth: () => Promise<{ userId: string | null }>,
  request: Request,
) => Promise<unknown>;

const clerkMiddlewareMock = vi.fn((handler: unknown) => handler);
const nextMock = vi.fn(() => ({ kind: "next" }));
const redirectMock = vi.fn((url: URL | string) => ({
  kind: "redirect",
  destination: typeof url === "string" ? url : url.toString(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: nextMock,
    redirect: redirectMock,
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  createRouteMatcher: (patterns: string[]) => {
    return (request: Request) => {
      const pathname = new URL(request.url).pathname;
      return patterns.some((pattern) => {
        if (pattern === "/") {
          return pathname === "/";
        }
        if (pattern === "/robots.txt") {
          return pathname === "/robots.txt";
        }
        if (pattern === "/sitemap.xml") {
          return pathname === "/sitemap.xml";
        }
        if (pattern === "/privacy(.*)") {
          return pathname === "/privacy" || pathname.startsWith("/privacy/");
        }
        if (pattern === "/terms(.*)") {
          return pathname === "/terms" || pathname.startsWith("/terms/");
        }
        if (pattern === "/device-qr(.*)") {
          return pathname === "/device-qr" || pathname.startsWith("/device-qr/");
        }
        if (pattern === "/api/device(.*)") {
          return pathname === "/api/device" || pathname.startsWith("/api/device/");
        }
        if (pattern === "/api/health(.*)") {
          return pathname === "/api/health" || pathname.startsWith("/api/health/");
        }
        if (pattern === "/sign-in(.*)") {
          return pathname === "/sign-in" || pathname.startsWith("/sign-in/");
        }
        if (pattern === "/sign-up(.*)") {
          return pathname === "/sign-up" || pathname.startsWith("/sign-up/");
        }
        return false;
      });
    };
  },
  clerkMiddleware: clerkMiddlewareMock,
}));

describe("proxy public routes", () => {
  beforeEach(() => {
    vi.resetModules();
    nextMock.mockClear();
    redirectMock.mockClear();
    clerkMiddlewareMock.mockClear();
    delete process.env.CLERK_AUTHORIZED_PARTIES;
  });

  it("allows /device-qr without Clerk session", async () => {
    const { default: importedProxy } = await import("../proxy");
    const proxy = importedProxy as unknown as ProxyHandler;

    const response = await proxy(
      async () => ({
        userId: null,
      }),
      new Request("https://app.example.com/device-qr?workspaceId=workspace_123456"),
    );

    expect(response).toEqual({ kind: "next" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("allows /api/device/qr-token without Clerk session", async () => {
    const { default: importedProxy } = await import("../proxy");
    const proxy = importedProxy as unknown as ProxyHandler;

    const response = await proxy(
      async () => ({
        userId: null,
      }),
      new Request("https://app.example.com/api/device/qr-token"),
    );

    expect(response).toEqual({ kind: "next" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("allows /robots.txt without Clerk session", async () => {
    const { default: importedProxy } = await import("../proxy");
    const proxy = importedProxy as unknown as ProxyHandler;

    const response = await proxy(
      async () => ({
        userId: null,
      }),
      new Request("https://app.example.com/robots.txt"),
    );

    expect(response).toEqual({ kind: "next" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("allows /sitemap.xml without Clerk session", async () => {
    const { default: importedProxy } = await import("../proxy");
    const proxy = importedProxy as unknown as ProxyHandler;

    const response = await proxy(
      async () => ({
        userId: null,
      }),
      new Request("https://app.example.com/sitemap.xml"),
    );

    expect(response).toEqual({ kind: "next" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("allows /privacy without Clerk session", async () => {
    const { default: importedProxy } = await import("../proxy");
    const proxy = importedProxy as unknown as ProxyHandler;

    const response = await proxy(
      async () => ({
        userId: null,
      }),
      new Request("https://app.example.com/privacy"),
    );

    expect(response).toEqual({ kind: "next" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("allows /terms without Clerk session", async () => {
    const { default: importedProxy } = await import("../proxy");
    const proxy = importedProxy as unknown as ProxyHandler;

    const response = await proxy(
      async () => ({
        userId: null,
      }),
      new Request("https://app.example.com/terms"),
    );

    expect(response).toEqual({ kind: "next" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects protected routes to the local sign-in page when user is anonymous", async () => {
    const { default: importedProxy } = await import("../proxy");
    const proxy = importedProxy as unknown as ProxyHandler;

    const response = await proxy(
      async () => ({
        userId: null,
      }),
      new Request("https://app.example.com/dashboard"),
    );

    expect(response).toEqual({
      kind: "redirect",
      destination: "https://app.example.com/sign-in?redirect_url=https%3A%2F%2Fapp.example.com%2Fdashboard",
    });
    expect(redirectMock).toHaveBeenCalledTimes(1);
  });

  it("preserves query params in the protected return URL", async () => {
    const { default: importedProxy } = await import("../proxy");
    const proxy = importedProxy as unknown as ProxyHandler;

    const response = await proxy(
      async () => ({
        userId: null,
      }),
      new Request("https://app.example.com/dashboard/report?range=this-week&workspaceId=workspace_123456"),
    );

    expect(response).toEqual({
      kind: "redirect",
      destination:
        "https://app.example.com/sign-in?redirect_url=https%3A%2F%2Fapp.example.com%2Fdashboard%2Freport%3Frange%3Dthis-week%26workspaceId%3Dworkspace_123456",
    });
    expect(redirectMock).toHaveBeenCalledTimes(1);
  });

  it("passes Clerk authorizedParties from env", async () => {
    process.env.CLERK_AUTHORIZED_PARTIES =
      "https://app.example.com, https://admin.example.com ";

    await import("../proxy");

    expect(clerkMiddlewareMock).toHaveBeenCalledTimes(1);
    expect(clerkMiddlewareMock).toHaveBeenCalledWith(expect.any(Function), {
      authorizedParties: [
        "https://app.example.com",
        "https://admin.example.com",
      ],
    });
  });

  it("omits Clerk authorizedParties when env is blank", async () => {
    process.env.CLERK_AUTHORIZED_PARTIES = "  ,  ";

    await import("../proxy");

    expect(clerkMiddlewareMock).toHaveBeenCalledTimes(1);
    expect(clerkMiddlewareMock).toHaveBeenCalledWith(
      expect.any(Function),
      undefined,
    );
  });
});
