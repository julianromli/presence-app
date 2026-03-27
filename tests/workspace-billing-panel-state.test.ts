import { describe, expect, it, vi } from "vitest";

import {
  canOpenWorkspaceCheckoutDialog,
  cancelWorkspaceBillingCheckout,
  getWorkspaceCheckoutActionLabel,
  getWorkspaceCheckoutDialogStatusCopy,
  isWorkspaceCheckoutConfirmEnabled,
  startWorkspaceBillingCheckout,
  WORKSPACE_PRO_PRICING_BENEFITS,
} from "../components/dashboard/workspace-billing-panel-state";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe("workspace billing panel state", () => {
  it("redirects to checkout immediately without waiting for refresh work", async () => {
    const refreshDeferred = createDeferred<void>();
    const steps: string[] = [];

    const result = await startWorkspaceBillingCheckout({
      billingPhone: "+62 81234567890",
      createCheckout: vi.fn(async () => ({
        invoice: {
          invoiceId: "invoice_123",
          paymentUrl: "https://mayar.example/invoice/123",
        },
        reused: false,
        workspaceId: "workspace_123",
      })),
      redirectToCheckout: (url) => {
        steps.push(`redirect:${url}`);
      },
      refreshBillingState: async () => {
        steps.push("refresh:start");
        await refreshDeferred.promise;
        steps.push("refresh:done");
      },
    });

    expect(result).toEqual({
      redirectedTo: "https://mayar.example/invoice/123",
    });
    expect(steps).toEqual([
      "redirect:https://mayar.example/invoice/123",
      "refresh:start",
    ]);

    refreshDeferred.resolve();
    await refreshDeferred.promise;
  });

  it("returns a warning notice when checkout has no payment url", async () => {
    const refreshBillingState = vi.fn(async () => undefined);

    const result = await startWorkspaceBillingCheckout({
      billingPhone: "+62 81234567890",
      createCheckout: vi.fn(async () => ({
        invoice: {
          invoiceId: "invoice_123",
        },
        reused: false,
        workspaceId: "workspace_123",
      })),
      redirectToCheckout: vi.fn(),
      refreshBillingState,
    });

    expect(result).toEqual({
      notice: {
        text: "Invoice berhasil dibuat, tapi tautan pembayaran belum tersedia.",
        tone: "warning",
      },
    });
    expect(refreshBillingState).toHaveBeenCalledTimes(1);
  });

  it("returns a success notice after canceling a pending invoice", async () => {
    const refreshBillingState = vi.fn(async () => undefined);

    const result = await cancelWorkspaceBillingCheckout({
      cancelCheckout: vi.fn(async () => undefined),
      refreshBillingState,
    });

    expect(result).toEqual({
      notice: {
        text: "Invoice pending berhasil dibatalkan.",
        tone: "success",
      },
    });
    expect(refreshBillingState).toHaveBeenCalledTimes(1);
  });

  it("opens the pricing dialog for a new checkout and labels the CTA correctly", () => {
    const summary = {
      allowedActions: {
        canCancelPendingInvoice: false,
        canCreateCheckout: true,
        canRefreshPendingInvoice: false,
        canViewInvoices: true,
      },
      pendingInvoice: null,
    };

    expect(canOpenWorkspaceCheckoutDialog(summary)).toBe(true);
    expect(isWorkspaceCheckoutConfirmEnabled(summary)).toBe(true);
    expect(getWorkspaceCheckoutActionLabel(summary)).toBe("Aktifkan Pro");
  });

  it("keeps the dialog available for pending invoices and switches the CTA copy", () => {
    const summary = {
      allowedActions: {
        canCancelPendingInvoice: true,
        canCreateCheckout: false,
        canRefreshPendingInvoice: false,
        canViewInvoices: true,
      },
      pendingInvoice: {
        invoiceId: "invoice_pending",
        paymentUrl: "https://mayar.example/invoice/123",
        status: "pending",
      },
    };

    expect(canOpenWorkspaceCheckoutDialog(summary)).toBe(true);
    expect(isWorkspaceCheckoutConfirmEnabled(summary)).toBe(true);
    expect(getWorkspaceCheckoutActionLabel(summary)).toBe("Lanjutkan pembayaran");
  });

  it("explains when a pending invoice is still initializing", () => {
    expect(
      getWorkspaceCheckoutDialogStatusCopy({
        invoiceId: "invoice_pending",
        status: "pending_initializing",
      } as never),
    ).toContain("masih disiapkan");
  });

  it("keeps the curated Pro benefit list compact and stable", () => {
    expect(WORKSPACE_PRO_PRICING_BENEFITS).toEqual([
      "Hingga 50 member aktif dalam satu workspace",
      "Hingga 3 device QR aktif tanpa recovery manual",
      "Geofence dan IP whitelist untuk guardrail operasional",
      "Export report dan masa berlaku invite yang bisa diatur",
    ]);
  });
});
