import { describe, expect, it, vi } from "vitest";

import {
  cancelWorkspaceBillingCheckout,
  startWorkspaceBillingCheckout,
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
});
