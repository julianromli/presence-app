import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@phosphor-icons/react", () => {
  const Icon = () => React.createElement("svg");
  return {
    Bell: Icon,
    CameraSlash: Icon,
    CheckCircle: Icon,
    MapPin: Icon,
    SpinnerGap: Icon,
    XCircle: Icon,
  };
});

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => React.createElement("a", { href }, children),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    render,
    ...props
  }: {
    children: React.ReactNode;
    render?: React.ReactElement;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    render
      ? React.cloneElement(render, props, children)
      : React.createElement("button", props, children),
}));

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({
    children,
  }: {
    children: React.ReactNode;
  }) => React.createElement("div", null, children),
  CollapsiblePanel: ({
    children,
  }: {
    children: React.ReactNode;
  }) => React.createElement("div", null, children),
  CollapsibleTrigger: ({
    children,
  }: {
    children: React.ReactNode;
  }) => React.createElement("button", null, children),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) =>
    React.createElement("input", props),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement("p", null, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogPanel: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogPopup: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement("h2", null, children),
}));

vi.mock("@/components/ui/scan-bottom-nav", () => ({
  ScanBottomNav: () => React.createElement("nav"),
}));

vi.mock("@/lib/workspace-client", () => ({
  workspaceFetch: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) =>
    values.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/scan-notifications-drawer", () => ({
  ScanNotificationsDrawer: () => null,
  useScanNotifications: () => ({
    unreadCount: 0,
    notifications: [],
    isLoading: false,
    markAllAsRead: vi.fn(),
    markAsRead: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("scan panel", () => {
  it("renders a dashboard shortcut in the main scan header", async () => {
    const { ScanPanel } = await import("../app/scan/scan-panel");
    const html = renderToStaticMarkup(React.createElement(ScanPanel));

    expect(html).toContain('href="/dashboard"');
    expect(html).toContain("Dashboard Saya");
  });

  it("renders the provided Clerk first name in the greeting", async () => {
    const { ScanPanel } = await import("../app/scan/scan-panel");
    const html = renderToStaticMarkup(
      React.createElement(ScanPanel, { firstName: "Faiz" }),
    );

    expect(html).toContain("Halo, Faiz");
  });

  it("retries location once when geofence coordinates or accuracy are required", async () => {
    const { submitScanWithLocationRetry } = await import("../app/scan/scan-panel");
    const sendScan = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            code: "GEOFENCE_COORD_REQUIRED",
            message: "Lokasi wajib diisi",
          },
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          status: "check-in",
          dateKey: "2026-03-17",
          message: "Check-in berhasil",
          scanAt: 1_234,
        }),
      );
    const getLocation = vi.fn(async () => ({
      latitude: -6.2,
      longitude: 106.8,
      accuracyMeters: 15,
    }));

    const result = await submitScanWithLocationRetry({
      value: "token-1",
      sendScan,
      buildIdempotencyKey: () => "idempotency-key",
      getLocation,
    });

    expect(result.response.ok).toBe(true);
    expect(sendScan).toHaveBeenCalledTimes(2);
    expect(getLocation).toHaveBeenCalledTimes(1);
  });

  it("fails closed when location retry cannot provide coordinates", async () => {
    const { submitScanWithLocationRetry } = await import("../app/scan/scan-panel");
    const sendScan = vi.fn().mockResolvedValue(
      Response.json(
        {
          code: "GEOFENCE_ACCURACY_REQUIRED",
          message: "Akurasi GPS wajib tersedia untuk scan di area kantor.",
        },
        { status: 400 },
      ),
    );
    const getLocation = vi.fn(async () => ({}));

    const result = await submitScanWithLocationRetry({
      value: "token-2",
      sendScan,
      buildIdempotencyKey: () => "idempotency-key",
      getLocation,
    });

    expect(result.response.ok).toBe(false);
    expect(sendScan).toHaveBeenCalledTimes(1);
    expect(getLocation).toHaveBeenCalledTimes(1);
    expect(result.data.code).toBe("GEOFENCE_ACCURACY_REQUIRED");
  });

  it("reads geolocation payload from the browser API", async () => {
    const { getLocationPayload } = await import("../app/scan/scan-panel");
    const originalNavigator = globalThis.navigator;

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        geolocation: {
          getCurrentPosition: (
            success: (position: {
              coords: { latitude: number; longitude: number; accuracy: number };
            }) => void,
          ) =>
            success({
              coords: {
                latitude: -6.2,
                longitude: 106.8,
                accuracy: 12,
              },
            }),
        },
      },
    });

    try {
      await expect(getLocationPayload(50)).resolves.toEqual({
        latitude: -6.2,
        longitude: 106.8,
        accuracyMeters: 12,
      });
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: originalNavigator,
      });
    }
  });
});
