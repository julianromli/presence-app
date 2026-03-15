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
});
