import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    isLoading,
    loadingText,
    render,
    ...props
  }: {
    children?: React.ReactNode;
    isLoading?: boolean;
    loadingText?: React.ReactNode;
    render?: React.ReactElement;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    render
      ? React.cloneElement(
          render,
          {
            ...props,
            "data-loading": isLoading || undefined,
            "data-loading-text": loadingText ? "true" : undefined,
          },
          children,
        )
      : React.createElement(
          "button",
          {
            ...props,
            "data-loading": isLoading || undefined,
            "data-loading-text": loadingText ? "true" : undefined,
          },
          children,
        ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-dialog": "root" }, children),
  DialogDescription: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLParagraphElement>) =>
    React.createElement("p", props, children),
  DialogFooter: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props, children),
  DialogHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props, children),
  DialogPanel: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props, children),
  DialogPopup: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props, children),
  DialogTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) =>
    React.createElement("h2", props, children),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => React.createElement("section", null, children),
  CardContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  CardDescription: ({ children }: { children: React.ReactNode }) => React.createElement("p", null, children),
  CardHeader: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  CardTitle: ({ children }: { children: React.ReactNode }) => React.createElement("h2", null, children),
}));

vi.mock("@/components/ui/confirmation-dialog", () => ({
  ConfirmationDialog: () => null,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) =>
    React.createElement("input", props),
}));

vi.mock("@/components/ui/menu", () => ({
  Menu: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  MenuItem: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  MenuPopup: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  MenuTrigger: ({
    children,
    render,
    ...props
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
  }) => (render ? React.cloneElement(render, props, children) : React.createElement("button", props, children)),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => React.createElement("table", null, children),
  TableBody: ({ children }: { children: React.ReactNode }) => React.createElement("tbody", null, children),
  TableCell: ({ children }: { children: React.ReactNode }) => React.createElement("td", null, children),
  TableHead: ({ children }: { children: React.ReactNode }) => React.createElement("th", null, children),
  TableHeader: ({ children }: { children: React.ReactNode }) => React.createElement("thead", null, children),
  TableRow: ({ children }: { children: React.ReactNode }) => React.createElement("tr", null, children),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  TooltipTrigger: ({
    children,
    render,
    ...props
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
  }) => (render ? React.cloneElement(render, props, children) : React.createElement("button", props, children)),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children?: React.ReactNode;
    href: string;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("@/lib/workspace-billing-client", () => ({
  cancelWorkspacePendingInvoice: vi.fn(),
  createWorkspaceCheckout: vi.fn(),
  fetchWorkspaceBillingInvoices: vi.fn(),
  fetchWorkspaceBillingSummary: vi.fn(),
  normalizeWorkspaceBillingError: vi.fn(),
  refreshWorkspacePendingInvoice: vi.fn(),
}));

vi.mock("@/lib/workspace-billing", () => ({
  buildWorkspaceBillingInvoiceHref: () => "/settings/workspace/invoices/invoice_123",
}));

vi.mock("@/lib/workspace-subscription-client", () => ({
  formatWorkspaceBillingPeriod: () => "1 Apr 2026 - 30 Apr 2026",
  getRestrictedWorkspaceOverlayCopy: () => null,
  refreshWorkspaceSubscription: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

describe("workspace billing pricing dialog", () => {
  it("renders price, benefits, and a direct activation CTA for new checkout", async () => {
    const { WorkspaceCheckoutPricingDialog } = await import(
      "../components/dashboard/workspace-billing-panel"
    );

    const html = renderToStaticMarkup(
      <WorkspaceCheckoutPricingDialog
        billingPhone="+62 81234567890"
        busyAction="none"
        onConfirm={() => undefined}
        onOpenChange={() => undefined}
        open={true}
        summary={{
          allowedActions: {
            canCancelPendingInvoice: false,
            canCreateCheckout: true,
            canRefreshPendingInvoice: false,
            canViewInvoices: true,
          },
          checkoutOffer: {
            amount: 150000,
            currency: "IDR",
            periodDays: 30,
            plan: "pro",
          },
          currentSubscription: null,
          pendingInvoice: null,
          plan: "free",
          restrictedState: {
            activeDevices: 1,
            activeMembers: 3,
            hadPaidOrManualEntitlement: false,
            isRestricted: false,
            overFreeDeviceLimit: false,
            overFreeMemberLimit: false,
          },
          workspaceId: "workspace_123456",
        }}
      />,
    );

    expect(html).toContain("Rp");
    expect(html).toContain("150.000");
    expect(html).toContain("Benefit Pro");
    expect(html).toContain("Hingga 50 member aktif dalam satu workspace");
    expect(html).toContain("Aktifkan Pro");
  });

  it("switches to pending-invoice messaging when checkout already exists", async () => {
    const { WorkspaceCheckoutPricingDialog } = await import(
      "../components/dashboard/workspace-billing-panel"
    );

    const html = renderToStaticMarkup(
      <WorkspaceCheckoutPricingDialog
        billingPhone="+62 81234567890"
        busyAction="none"
        onConfirm={() => undefined}
        onOpenChange={() => undefined}
        open={true}
        summary={{
          allowedActions: {
            canCancelPendingInvoice: true,
            canCreateCheckout: false,
            canRefreshPendingInvoice: true,
            canViewInvoices: true,
          },
          checkoutOffer: {
            amount: 150000,
            currency: "IDR",
            periodDays: 30,
            plan: "pro",
          },
          currentSubscription: null,
          pendingInvoice: {
            amount: 150000,
            currency: "IDR",
            expiresAt: 1_900_003_600_000,
            invoiceId: "invoice_pending",
            issuedAt: 1_900_000_000_000,
            paymentUrl: "https://mayar.example/invoice/123",
            pollAttempts: 0,
            provider: "mayar",
            status: "pending",
          },
          plan: "free",
          restrictedState: {
            activeDevices: 1,
            activeMembers: 3,
            hadPaidOrManualEntitlement: true,
            isRestricted: false,
            overFreeDeviceLimit: false,
            overFreeMemberLimit: false,
          },
          workspaceId: "workspace_123456",
        }}
      />,
    );

    expect(html).toContain("Lanjutkan pembayaran");
    expect(html).toContain("invoice_pending");
    expect(html).toContain("Invoice aktif dan siap dibayar");
  });
});
