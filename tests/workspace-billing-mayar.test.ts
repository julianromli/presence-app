import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../convex/_generated/server", () => ({
  internalAction: (config: unknown) => config,
}));

vi.mock("../convex/_generated/api", () => ({
  internal: {
    workspaceBilling: {
      getStoredMayarCustomer:
        "internal:workspaceBilling.getStoredMayarCustomer",
      upsertStoredMayarCustomer:
        "internal:workspaceBilling.upsertStoredMayarCustomer",
    },
  },
}));

describe("workspace billing Mayar integration", () => {
  function getHandler(fn: unknown) {
    return (fn as { handler: (...args: unknown[]) => Promise<unknown> }).handler;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
    process.env.MAYAR_API_KEY = "mayar_test_key";
    process.env.MAYAR_API_BASE_URL = "https://api.mayar.club/hl/v1";
    process.env.MAYAR_REDIRECT_URL = "http://localhost:3000/settings/workspace";
    delete process.env.APP_SITE_URL;
  });

  it("normalizes a configured base url that already includes /hl/v1", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            customerId: "mayar_customer_123",
          },
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { createMayarCustomerIfNeeded } = await import(
      "../convex/workspaceBillingMayar"
    );

    const runQuery = vi.fn(async (reference: string) => {
      if (reference === "internal:workspaceBilling.getStoredMayarCustomer") {
        return null;
      }

      throw new Error(`Unexpected runQuery call: ${reference}`);
    });
    const runMutation = vi.fn(async (_reference: string, args: Record<string, unknown>) => ({
      workspaceId: args.workspaceId,
      providerCustomerId: args.providerCustomerId,
      name: args.name,
      email: args.email,
      phone: args.phone,
    }));

    const result = await getHandler(createMayarCustomerIfNeeded)(
      {
        runMutation,
        runQuery,
      } as never,
      {
        billingPhone: "+6281234567890",
        email: "owner@absenin.id",
        name: "Owner Workspace",
        workspaceId: "workspace_123456" as never,
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mayar.club/hl/v1/customer/create",
      expect.objectContaining({
        body: JSON.stringify({
          name: "Owner Workspace",
          email: "owner@absenin.id",
          mobile: "+6281234567890",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer mayar_test_key",
          "content-type": "application/json",
        }),
        method: "POST",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result).toEqual({
      email: "owner@absenin.id",
      name: "Owner Workspace",
      phone: "+6281234567890",
      providerCustomerId: "mayar_customer_123",
      workspaceId: "workspace_123456",
    });
  });

  it("builds redirectUrl from APP_SITE_URL when explicit redirect env is missing", async () => {
    process.env.MAYAR_REDIRECT_URL = "";
    process.env.APP_SITE_URL = "https://app.absenin.id/";

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            expiredAt: 1_900_086_400_000,
            id: "mayar_invoice_123",
            link: "https://mayar.example/invoice/123",
            status: "unpaid",
            transactionId: "mayar_txn_123",
          },
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { createMayarInvoice } = await import("../convex/workspaceBillingMayar");

    const result = await getHandler(createMayarInvoice)(
      {} as never,
      {
        amount: 150000,
        billingPhone: "+6281234567890",
        customerEmail: "owner@absenin.id",
        customerName: "Owner Workspace",
        invoiceId: "invoice_123",
        providerCustomerId: "mayar_customer_123",
        subscriptionId: "subscription_123",
        workspaceId: "workspace_123456" as never,
      },
    );

    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toMatchObject({
      redirectUrl: "https://app.absenin.id/settings/workspace",
    });
    expect(result).toEqual({
      expiresAt: 1_900_086_400_000,
      paymentUrl: "https://mayar.example/invoice/123",
      providerInvoiceId: "mayar_invoice_123",
      providerStatusText: "unpaid",
      providerTransactionId: "mayar_txn_123",
      rawProviderSnapshot: {
        expiredAt: 1_900_086_400_000,
        id: "mayar_invoice_123",
        link: "https://mayar.example/invoice/123",
        status: "unpaid",
        transactionId: "mayar_txn_123",
      },
    });
  });

  it("wraps aborted Mayar requests as billing sync failures", async () => {
    const abortError = Object.assign(new Error("Request aborted"), {
      name: "AbortError",
    });
    const fetchMock = vi.fn(async () => {
      throw abortError;
    });
    vi.stubGlobal("fetch", fetchMock);

    const { createMayarCustomerIfNeeded } = await import(
      "../convex/workspaceBillingMayar"
    );

    const runQuery = vi.fn(async () => null);
    const runMutation = vi.fn();

    await expect(
      getHandler(createMayarCustomerIfNeeded)(
        {
          runMutation,
          runQuery,
        } as never,
        {
          billingPhone: "+6281234567890",
          email: "owner@absenin.id",
          name: "Owner Workspace",
          workspaceId: "workspace_123456" as never,
        },
      ),
    ).rejects.toMatchObject({
      data: {
        code: "BILLING_SYNC_FAILED",
        message: "Permintaan ke Mayar melebihi batas waktu.",
      },
    });
    expect(runMutation).not.toHaveBeenCalled();
  });
});
