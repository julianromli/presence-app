import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const requireWorkspaceRole = vi.fn();
const requireWorkspaceRoleFromAction = vi.fn();
const getWorkspaceSubscriptionSummary = vi.fn();
type HandlerResult = { handler: (...args: unknown[]) => Promise<unknown> };

function getHandler(fn: unknown) {
  return (fn as { handler: (...args: unknown[]) => Promise<unknown> }).handler;
}

vi.mock("../convex/_generated/server", () => ({
  action: (config: unknown) => config,
  internalAction: (config: unknown) => config,
  internalMutation: (config: unknown) => config,
  internalQuery: (config: unknown) => config,
  query: (config: unknown) => config,
}));

vi.mock("../convex/_generated/api", () => ({
  internal: {
    workspaceBilling: {
      activatePaidWorkspacePeriod:
        "internal:workspaceBilling.activatePaidWorkspacePeriod",
      getPendingInvoiceForRefresh:
        "internal:workspaceBilling.getPendingInvoiceForRefresh",
      getWorkspaceBillingSummaryFromMutation:
        "internal:workspaceBilling.getWorkspaceBillingSummaryFromMutation",
      expireWorkspacePeriod: "internal:workspaceBilling.expireWorkspacePeriod",
      expireActiveWorkspacePeriods:
        "internal:workspaceBilling.expireActiveWorkspacePeriods",
      markInvoiceFromProvider:
        "internal:workspaceBilling.markInvoiceFromProvider",
      listExpiredActiveWorkspacePeriods:
        "internal:workspaceBilling.listExpiredActiveWorkspacePeriods",
      listPendingInvoicesForReconciliation:
        "internal:workspaceBilling.listPendingInvoicesForReconciliation",
      reconcilePendingWorkspaceInvoices:
        "internal:workspaceBilling.reconcilePendingWorkspaceInvoices",
      reserveWorkspaceCheckout:
        "internal:workspaceBilling.reserveWorkspaceCheckout",
      finalizeWorkspaceCheckoutSuccess:
        "internal:workspaceBilling.finalizeWorkspaceCheckoutSuccess",
      finalizeWorkspaceCheckoutFailure:
        "internal:workspaceBilling.finalizeWorkspaceCheckoutFailure",
      cancelPendingInvoice: "internal:workspaceBilling.cancelPendingInvoice",
    },
    workspaceBillingMayar: {
      createMayarCustomerIfNeeded:
        "internal:workspaceBillingMayar.createMayarCustomerIfNeeded",
      createMayarInvoice: "internal:workspaceBillingMayar.createMayarInvoice",
      closeMayarInvoice: "internal:workspaceBillingMayar.closeMayarInvoice",
      fetchMayarInvoiceStatus:
        "internal:workspaceBillingMayar.fetchMayarInvoiceStatus",
    },
  },
}));

vi.mock("../convex/helpers", () => ({
  requireWorkspaceRole,
  requireWorkspaceRoleFromAction,
}));

vi.mock("../convex/workspaceSubscription", () => ({
  getWorkspaceSubscriptionSummary,
}));

describe("workspace billing convex checkout flow", () => {
  const originalWorkspaceProPriceIdr = process.env.WORKSPACE_PRO_PRICE_IDR;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    process.env.WORKSPACE_PRO_PRICE_IDR = originalWorkspaceProPriceIdr;
    vi.spyOn(Date, "now").mockReturnValue(1_900_000_000_000);
    getWorkspaceSubscriptionSummary.mockResolvedValue({
      usage: {
        activeDevices: 1,
        activeMembers: 3,
      },
    });
    requireWorkspaceRole.mockResolvedValue({
      user: {
        _id: "user_superadmin",
        email: "owner@absenin.id",
        name: "Owner Workspace",
      },
      membership: { role: "superadmin" },
    });
    requireWorkspaceRoleFromAction.mockResolvedValue({
      user: {
        _id: "user_superadmin",
        email: "owner@absenin.id",
        name: "Owner Workspace",
      },
      membership: { role: "superadmin" },
    });
  });

  afterAll(() => {
    process.env.WORKSPACE_PRO_PRICE_IDR = originalWorkspaceProPriceIdr;
  });

  it("reuses an existing open checkout before calling Mayar", async () => {
    const { createWorkspaceCheckout } =
      await import("../convex/workspaceBilling");
    const runMutation = vi.fn(async (reference: string) => {
      if (reference === "internal:workspaceBilling.reserveWorkspaceCheckout") {
        return {
          invoice: {
            amount: 150000,
            currency: "IDR",
            invoiceId: "invoice_existing",
            issuedAt: 1_900_000_000_000,
            paymentUrl: "https://mayar.example/invoice/existing",
            pollAttempts: 0,
            provider: "mayar",
            status: "pending",
          },
          reused: true,
          workspaceId: "workspace_123456",
        };
      }

      throw new Error(`Unexpected runMutation call: ${reference}`);
    });
    const runAction = vi.fn();

    const result = await getHandler(createWorkspaceCheckout)(
      {
        runAction,
        runMutation,
      } as never,
      {
        billingPhone: "+6281234567890",
        workspaceId: "workspace_123456" as never,
      },
    );

    expect(result).toEqual({
      invoice: expect.objectContaining({
        invoiceId: "invoice_existing",
        paymentUrl: "https://mayar.example/invoice/existing",
        status: "pending",
      }),
      reused: true,
      workspaceId: "workspace_123456",
    });
    expect(runAction).not.toHaveBeenCalled();
  });

  it("creates a Mayar customer and invoice when no open checkout exists", async () => {
    const { createWorkspaceCheckout } =
      await import("../convex/workspaceBilling");
    const finalizeWorkspaceCheckoutSuccess = vi.fn(
      async (...args: [Record<string, unknown>]) => {
        void args;
        return {
          invoice: {
            amount: 150000,
            currency: "IDR",
            invoiceId: "invoice_reserved",
            issuedAt: 1_900_000_000_000,
            paymentUrl: "https://mayar.example/invoice/new",
            pollAttempts: 0,
            provider: "mayar",
            providerInvoiceId: "mayar_invoice_123",
            providerTransactionId: "mayar_txn_123",
            status: "pending",
          },
          reused: false,
          workspaceId: "workspace_123456",
        };
      },
    );
    const runMutation = vi.fn(
      async (reference: string, args: Record<string, unknown>) => {
        if (
          reference === "internal:workspaceBilling.reserveWorkspaceCheckout"
        ) {
          return {
            createdByUserId: "user_superadmin",
            invoiceId: "invoice_reserved",
            invoiceIssuedAt: 1_900_000_000_000,
            subscriptionId: "subscription_reserved",
            workspaceId: "workspace_123456",
          };
        }

        if (
          reference ===
          "internal:workspaceBilling.finalizeWorkspaceCheckoutSuccess"
        ) {
          return await finalizeWorkspaceCheckoutSuccess(args);
        }

        throw new Error(`Unexpected runMutation call: ${reference}`);
      },
    );
    const runAction = vi.fn(async (reference: string) => {
      if (
        reference ===
        "internal:workspaceBillingMayar.createMayarCustomerIfNeeded"
      ) {
        return {
          email: "owner@absenin.id",
          name: "Owner Workspace",
          phone: "+6281234567890",
          providerCustomerId: "mayar_customer_123",
          workspaceId: "workspace_123456",
        };
      }

      if (reference === "internal:workspaceBillingMayar.createMayarInvoice") {
        return {
          expiresAt: 1_900_003_600_000,
          paymentUrl: "https://mayar.example/invoice/new",
          providerInvoiceId: "mayar_invoice_123",
          providerStatusText: "unpaid",
          providerTransactionId: "mayar_txn_123",
          rawProviderSnapshot: { id: "mayar_invoice_123", status: "unpaid" },
        };
      }

      throw new Error(`Unexpected runAction call: ${reference}`);
    });

    const result = await getHandler(createWorkspaceCheckout)(
      {
        runAction,
        runMutation,
      } as never,
      {
        billingPhone: "+6281234567890",
        workspaceId: "workspace_123456" as never,
      },
    );

    expect(runAction).toHaveBeenCalledWith(
      "internal:workspaceBillingMayar.createMayarCustomerIfNeeded",
      {
        billingPhone: "+6281234567890",
        email: "owner@absenin.id",
        name: "Owner Workspace",
        workspaceId: "workspace_123456",
      },
    );
    expect(runAction).toHaveBeenCalledWith(
      "internal:workspaceBillingMayar.createMayarInvoice",
      expect.objectContaining({
        billingPhone: "+6281234567890",
        customerEmail: "owner@absenin.id",
        customerName: "Owner Workspace",
        providerCustomerId: "mayar_customer_123",
        workspaceId: "workspace_123456",
      }),
    );
    expect(result).toEqual({
      invoice: expect.objectContaining({
        invoiceId: "invoice_reserved",
        paymentUrl: "https://mayar.example/invoice/new",
        providerInvoiceId: "mayar_invoice_123",
        status: "pending",
      }),
      reused: false,
      workspaceId: "workspace_123456",
    });
  });

  it("marks reserved checkout failed when Mayar invoice creation throws", async () => {
    const { createWorkspaceCheckout } =
      await import("../convex/workspaceBilling");
    const finalizeWorkspaceCheckoutFailure = vi.fn(
      async (...args: [Record<string, unknown>]) => {
        void args;
        return null;
      },
    );
    const runMutation = vi.fn(
      async (reference: string, args: Record<string, unknown>) => {
        if (
          reference === "internal:workspaceBilling.reserveWorkspaceCheckout"
        ) {
          return {
            createdByUserId: "user_superadmin",
            invoiceId: "invoice_reserved",
            invoiceIssuedAt: 1_900_000_000_000,
            subscriptionId: "subscription_reserved",
            workspaceId: "workspace_123456",
          };
        }

        if (
          reference ===
          "internal:workspaceBilling.finalizeWorkspaceCheckoutFailure"
        ) {
          return await finalizeWorkspaceCheckoutFailure(args);
        }

        throw new Error(`Unexpected runMutation call: ${reference}`);
      },
    );
    const runAction = vi.fn(async (reference: string) => {
      if (
        reference ===
        "internal:workspaceBillingMayar.createMayarCustomerIfNeeded"
      ) {
        return {
          email: "owner@absenin.id",
          name: "Owner Workspace",
          phone: "+6281234567890",
          providerCustomerId: "mayar_customer_123",
          workspaceId: "workspace_123456",
        };
      }

      if (reference === "internal:workspaceBillingMayar.createMayarInvoice") {
        throw new Error("Mayar unavailable");
      }

      throw new Error(`Unexpected runAction call: ${reference}`);
    });

    await expect(
      getHandler(createWorkspaceCheckout)(
        {
          runAction,
          runMutation,
        } as never,
        {
          billingPhone: "+6281234567890",
          workspaceId: "workspace_123456" as never,
        },
      ),
    ).rejects.toThrow("Mayar unavailable");

    expect(finalizeWorkspaceCheckoutFailure).toHaveBeenCalledWith({
      invoiceId: "invoice_reserved",
      providerStatusText: "Mayar unavailable",
      subscriptionId: "subscription_reserved",
      workspaceId: "workspace_123456",
    });
  });

  it("keeps pending_initializing reservations open when provider failure is ambiguous", async () => {
    const { createWorkspaceCheckout } =
      await import("../convex/workspaceBilling");
    const finalizeWorkspaceCheckoutFailure = vi.fn(
      async (...args: [Record<string, unknown>]) => {
        void args;
        return null;
      },
    );
    const runMutation = vi.fn(
      async (reference: string, args: Record<string, unknown>) => {
        if (
          reference === "internal:workspaceBilling.reserveWorkspaceCheckout"
        ) {
          return {
            createdByUserId: "user_superadmin",
            invoiceId: "invoice_reserved",
            invoiceIssuedAt: 1_900_000_000_000,
            subscriptionId: "subscription_reserved",
            workspaceId: "workspace_123456",
          };
        }

        if (
          reference ===
          "internal:workspaceBilling.finalizeWorkspaceCheckoutFailure"
        ) {
          return await finalizeWorkspaceCheckoutFailure(args);
        }

        throw new Error(`Unexpected runMutation call: ${reference}`);
      },
    );
    const ambiguousError = new Error("Mayar sync unavailable") as Error & {
      data?: { code: string; message: string };
    };
    ambiguousError.data = {
      code: "BILLING_SYNC_FAILED",
      message: "Mayar sync unavailable",
    };
    const runAction = vi.fn(async (reference: string) => {
      if (
        reference ===
        "internal:workspaceBillingMayar.createMayarCustomerIfNeeded"
      ) {
        return {
          email: "owner@absenin.id",
          name: "Owner Workspace",
          phone: "+6281234567890",
          providerCustomerId: "mayar_customer_123",
          workspaceId: "workspace_123456",
        };
      }

      if (reference === "internal:workspaceBillingMayar.createMayarInvoice") {
        throw ambiguousError;
      }

      throw new Error(`Unexpected runAction call: ${reference}`);
    });

    await expect(
      getHandler(createWorkspaceCheckout)(
        {
          runAction,
          runMutation,
        } as never,
        {
          billingPhone: "+6281234567890",
          workspaceId: "workspace_123456" as never,
        },
      ),
    ).rejects.toBe(ambiguousError);

    expect(finalizeWorkspaceCheckoutFailure).not.toHaveBeenCalled();
  });

  it("releases stale pending_initializing invoices without a provider reference before reserving a new checkout", async () => {
    const { reserveWorkspaceCheckout } =
      await import("../convex/workspaceBilling");
    const workspace = {
      _id: "workspace_123456",
      slug: "workspace",
      name: "Workspace",
      plan: "free",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    };
    const subscriptions = [
      {
        _id: "subscription_stale",
        workspaceId: "workspace_123456",
        status: "pending",
        provider: "mayar",
        kind: "pro_one_time",
        startedAt: 1_899_999_000_000,
        createdByUserId: "user_superadmin",
        updatedAt: 1_899_999_000_000,
      },
    ];
    const invoices = [
      {
        _id: "invoice_stale",
        workspaceId: "workspace_123456",
        subscriptionId: "subscription_stale",
        provider: "mayar",
        status: "pending_initializing",
        amount: 150000,
        currency: "IDR",
        paymentUrl: undefined,
        providerInvoiceId: undefined,
        providerStatusText: undefined,
        issuedAt: 1_900_000_000_000 - 10 * 60 * 1000,
        pollAttempts: 0,
      },
    ];
    const patches: Array<{ id: string; value: Record<string, unknown> }> = [];
    const events: Array<Record<string, unknown>> = [];
    const inserts: Array<{ table: string; value: Record<string, unknown> }> =
      [];
    const ctx = {
      db: {
        get: vi.fn(async (id: string) => {
          if (id === "workspace_123456") {
            return workspace;
          }

          if (id === "subscription_stale") {
            return subscriptions[0];
          }

          return null;
        }),
        insert: vi.fn(async (table: string, value: Record<string, unknown>) => {
          inserts.push({ table, value });

          if (table === "workspace_subscriptions") {
            return "subscription_new";
          }

          if (table === "workspace_billing_invoices") {
            return "invoice_new";
          }

          if (table === "workspace_subscription_events") {
            events.push(value);
            return `event_${events.length}`;
          }

          throw new Error(`Unexpected insert table: ${table}`);
        }),
        patch: vi.fn(async (id: string, value: Record<string, unknown>) => {
          patches.push({ id, value });
        }),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn(
            (
              indexName: string,
              builder: (query: {
                eq: (field: string, value: unknown) => unknown;
              }) => unknown,
            ) => {
              const filters: Record<string, unknown> = {};
              const queryBuilder = {
                eq(field: string, value: unknown) {
                  filters[field] = value;
                  return queryBuilder;
                },
              };
              builder(queryBuilder);

              if (table === "workspace_subscriptions") {
                return {
                  collect: vi.fn(async () =>
                    subscriptions.filter(
                      (row) =>
                        row.workspaceId === filters.workspaceId &&
                        row.status === filters.status,
                    ),
                  ),
                };
              }

              if (table === "workspace_billing_invoices") {
                return {
                  collect: vi.fn(async () =>
                    invoices.filter(
                      (row) =>
                        row.workspaceId === filters.workspaceId &&
                        row.status === filters.status,
                    ),
                  ),
                };
              }

              throw new Error(
                `Unexpected table/index combination: ${table}/${indexName}`,
              );
            },
          ),
        })),
      },
    };

    const result = await getHandler(reserveWorkspaceCheckout)(ctx as never, {
      billingPhone: "+6281234567890",
      createdByUserId: "user_superadmin" as never,
      workspaceId: "workspace_123456" as never,
    });

    expect(patches).toEqual(
      expect.arrayContaining([
        {
          id: "invoice_stale",
          value: expect.objectContaining({
            providerStatusText:
              "Sinkronisasi invoice Mayar terhenti sebelum referensi pembayaran tersedia.",
            status: "failed",
          }),
        },
        {
          id: "subscription_stale",
          value: expect.objectContaining({
            canceledAt: 1_900_000_000_000,
            status: "canceled",
            updatedAt: 1_900_000_000_000,
          }),
        },
      ]),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventKey: "invoice_failed:invoice_stale",
          eventType: "invoice_failed",
          invoiceId: "invoice_stale",
          subscriptionId: "subscription_stale",
          workspaceId: "workspace_123456",
        }),
      ]),
    );
    expect(result).toEqual({
      createdByUserId: "user_superadmin",
      invoiceId: "invoice_new",
      invoiceIssuedAt: 1_900_000_000_000,
      subscriptionId: "subscription_new",
      workspaceId: "workspace_123456",
    });
    expect(inserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "workspace_subscriptions" }),
        expect.objectContaining({ table: "workspace_billing_invoices" }),
      ]),
    );
  });

  it("refreshes a paid pending invoice into an active pro period", async () => {
    const { refreshWorkspacePendingInvoice } =
      await import("../convex/workspaceBilling");
    const markInvoiceFromProvider = vi.fn(
      async (...args: [Record<string, unknown>]) => {
        void args;
        return {
          invoice: {
            amount: 150000,
            currency: "IDR",
            invoiceId: "invoice_pending",
            issuedAt: 1_900_000_000_000,
            paidAt: 1_900_000_100_000,
            paymentUrl: "https://mayar.example/invoice/pending",
            pollAttempts: 1,
            provider: "mayar",
            providerInvoiceId: "mayar_invoice_pending",
            providerTransactionId: "mayar_txn_paid",
            status: "paid",
          },
          subscription: {
            activatedAt: undefined,
            currentPeriodEndsAt: undefined,
            currentPeriodStartsAt: undefined,
            kind: "pro_one_time",
            provider: "mayar",
            startedAt: 1_900_000_000_000,
            status: "pending",
            subscriptionId: "subscription_pending",
            updatedAt: 1_900_000_000_000,
          },
          workspaceId: "workspace_123456",
        };
      },
    );
    const activatePaidWorkspacePeriod = vi.fn(
      async (...args: [Record<string, unknown>]) => {
        void args;
        return {
          allowedActions: {
            canCancelPendingInvoice: false,
            canCreateCheckout: false,
            canRefreshPendingInvoice: false,
            canViewInvoices: true,
          },
          currentSubscription: {
            activatedAt: 1_900_000_100_000,
            currentPeriodEndsAt: 1_902_592_100_000,
            currentPeriodStartsAt: 1_900_000_100_000,
            kind: "pro_one_time",
            provider: "mayar",
            startedAt: 1_900_000_000_000,
            status: "active",
            subscriptionId: "subscription_pending",
            updatedAt: 1_900_000_100_000,
          },
          pendingInvoice: null,
          plan: "pro",
          restrictedState: {
            activeDevices: 1,
            activeMembers: 3,
            hadPaidOrManualEntitlement: true,
            isRestricted: false,
            overFreeDeviceLimit: false,
            overFreeMemberLimit: false,
          },
          workspaceId: "workspace_123456",
        };
      },
    );
    const runMutation = vi.fn(
      async (reference: string, args: Record<string, unknown>) => {
        if (reference === "internal:workspaceBilling.markInvoiceFromProvider") {
          return await markInvoiceFromProvider(args);
        }

        if (
          reference === "internal:workspaceBilling.activatePaidWorkspacePeriod"
        ) {
          return await activatePaidWorkspacePeriod(args);
        }

        throw new Error(`Unexpected runMutation call: ${reference}`);
      },
    );
    const runAction = vi.fn(async (reference: string) => {
      if (
        reference === "internal:workspaceBillingMayar.fetchMayarInvoiceStatus"
      ) {
        return {
          amount: 150000,
          expiresAt: 1_900_003_600_000,
          paidAt: 1_900_000_100_000,
          paymentUrl: "https://mayar.example/invoice/pending",
          providerInvoiceId: "mayar_invoice_pending",
          providerStatusText: "paid",
          providerTransactionId: "mayar_txn_paid",
          rawProviderSnapshot: { id: "mayar_invoice_pending", status: "paid" },
        };
      }

      throw new Error(`Unexpected runAction call: ${reference}`);
    });
    const runQuery = vi.fn(async () => ({
      amount: 150000,
      currency: "IDR",
      invoiceId: "invoice_pending",
      paymentUrl: "https://mayar.example/invoice/pending",
      pollAttempts: 0,
      provider: "mayar",
      providerInvoiceId: "mayar_invoice_pending",
      status: "pending",
      subscriptionId: "subscription_pending",
      workspaceId: "workspace_123456",
    }));

    const result = await getHandler(refreshWorkspacePendingInvoice)(
      {
        runAction,
        runMutation,
        runQuery,
      } as never,
      {
        workspaceId: "workspace_123456" as never,
      },
    );

    expect(runAction).toHaveBeenCalledWith(
      "internal:workspaceBillingMayar.fetchMayarInvoiceStatus",
      { providerInvoiceId: "mayar_invoice_pending" },
    );
    expect(markInvoiceFromProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: "invoice_pending",
        paidAt: 1_900_000_100_000,
        providerStatusText: "paid",
        subscriptionId: "subscription_pending",
      }),
    );
    expect(activatePaidWorkspacePeriod).toHaveBeenCalledWith({
      paidAt: 1_900_000_100_000,
      subscriptionId: "subscription_pending",
      workspaceId: "workspace_123456",
    });
    expect(result).toEqual(
      expect.objectContaining({
        plan: "pro",
        workspaceId: "workspace_123456",
      }),
    );
  });

  it("cancels a pending invoice after closing it in Mayar", async () => {
    const module = await import("../convex/workspaceBilling");
    const cancelWorkspacePendingInvoice = (
      module as typeof module & {
        cancelWorkspacePendingInvoice: HandlerResult;
      }
    ).cancelWorkspacePendingInvoice;
    const runQuery = vi.fn(async (reference: string) => {
      if (
        reference === "internal:workspaceBilling.getPendingInvoiceForRefresh"
      ) {
        return {
          invoiceId: "invoice_pending",
          providerInvoiceId: "mayar_invoice_pending",
          subscriptionId: "subscription_pending",
          workspaceId: "workspace_123456",
        };
      }

      throw new Error(`Unexpected runQuery call: ${reference}`);
    });
    const runAction = vi.fn(async (reference: string) => {
      if (reference === "internal:workspaceBillingMayar.closeMayarInvoice") {
        return {
          providerInvoiceId: "mayar_invoice_pending",
          providerStatusText: "closed",
        };
      }

      throw new Error(`Unexpected runAction call: ${reference}`);
    });
    const cancelPendingInvoice = vi.fn(
      async (args: Record<string, unknown>) => ({
        allowedActions: {
          canCancelPendingInvoice: false,
          canCreateCheckout: true,
          canRefreshPendingInvoice: false,
          canViewInvoices: true,
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
        workspaceId: args.workspaceId,
      }),
    );
    const runMutation = vi.fn(
      async (reference: string, args: Record<string, unknown>) => {
        if (reference === "internal:workspaceBilling.cancelPendingInvoice") {
          return await cancelPendingInvoice(args);
        }

        throw new Error(`Unexpected runMutation call: ${reference}`);
      },
    );

    const result = await getHandler(cancelWorkspacePendingInvoice)(
      {
        runAction,
        runMutation,
        runQuery,
      } as never,
      {
        workspaceId: "workspace_123456" as never,
      },
    );

    expect(runAction).toHaveBeenCalledWith(
      "internal:workspaceBillingMayar.closeMayarInvoice",
      { providerInvoiceId: "mayar_invoice_pending" },
    );
    expect(cancelPendingInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: "invoice_pending",
        providerStatusText: "closed",
        subscriptionId: "subscription_pending",
        workspaceId: "workspace_123456",
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        allowedActions: expect.objectContaining({
          canCreateCheckout: true,
        }),
        pendingInvoice: null,
        workspaceId: "workspace_123456",
      }),
    );
  });

  it("cancels a pending_initializing invoice locally when provider reference is missing", async () => {
    const module = await import("../convex/workspaceBilling");
    const cancelWorkspacePendingInvoice = (
      module as typeof module & {
        cancelWorkspacePendingInvoice: HandlerResult;
      }
    ).cancelWorkspacePendingInvoice;
    const runQuery = vi.fn(async (reference: string) => {
      if (
        reference === "internal:workspaceBilling.getPendingInvoiceForRefresh"
      ) {
        return {
          invoiceId: "invoice_initializing",
          providerInvoiceId: undefined,
          subscriptionId: "subscription_pending",
          workspaceId: "workspace_123456",
        };
      }

      throw new Error(`Unexpected runQuery call: ${reference}`);
    });
    const runAction = vi.fn();
    const cancelPendingInvoice = vi.fn(
      async (_args: Record<string, unknown>) => ({
        allowedActions: {
          canCancelPendingInvoice: false,
          canCreateCheckout: true,
          canRefreshPendingInvoice: false,
          canViewInvoices: true,
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
      }),
    );
    const runMutation = vi.fn(
      async (reference: string, args: Record<string, unknown>) => {
        if (reference === "internal:workspaceBilling.cancelPendingInvoice") {
          return await cancelPendingInvoice(args);
        }

        throw new Error(`Unexpected runMutation call: ${reference}`);
      },
    );

    await getHandler(cancelWorkspacePendingInvoice)(
      {
        runAction,
        runMutation,
        runQuery,
      } as never,
      {
        workspaceId: "workspace_123456" as never,
      },
    );

    expect(runAction).not.toHaveBeenCalled();
    expect(cancelPendingInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: "invoice_initializing",
        providerStatusText:
          "Dibatalkan oleh superadmin sebelum referensi pembayaran tersedia.",
      }),
    );
  });

  it("rebuilds billing summary after refresh through an internal query boundary", async () => {
    const { refreshWorkspacePendingInvoice } =
      await import("../convex/workspaceBilling");
    const runMutation = vi.fn(async (reference: string) => {
      if (reference === "internal:workspaceBilling.markInvoiceFromProvider") {
        return {
          invoice: {
            amount: 150000,
            currency: "IDR",
            invoiceId: "invoice_pending",
            issuedAt: 1_900_000_000_000,
            paymentUrl: "https://mayar.example/invoice/pending",
            pollAttempts: 1,
            provider: "mayar",
            providerInvoiceId: "mayar_invoice_pending",
            providerStatusText: "unpaid",
            status: "pending",
          },
          subscription: {
            kind: "pro_one_time",
            provider: "mayar",
            startedAt: 1_900_000_000_000,
            status: "pending",
            subscriptionId: "subscription_pending",
            updatedAt: 1_900_000_000_000,
          },
          workspaceId: "workspace_123456",
        };
      }

      throw new Error(`Unexpected runMutation call: ${reference}`);
    });
    const runAction = vi.fn(async (reference: string) => {
      if (
        reference === "internal:workspaceBillingMayar.fetchMayarInvoiceStatus"
      ) {
        return {
          amount: 150000,
          expiresAt: 1_900_003_600_000,
          paymentUrl: "https://mayar.example/invoice/pending",
          providerInvoiceId: "mayar_invoice_pending",
          providerStatusText: "unpaid",
          rawProviderSnapshot: {
            id: "mayar_invoice_pending",
            status: "unpaid",
          },
        };
      }

      throw new Error(`Unexpected runAction call: ${reference}`);
    });
    const runQuery = vi.fn(async (reference: string) => {
      if (
        reference === "internal:workspaceBilling.getPendingInvoiceForRefresh"
      ) {
        return {
          invoiceId: "invoice_pending",
          providerInvoiceId: "mayar_invoice_pending",
          subscriptionId: "subscription_pending",
          workspaceId: "workspace_123456",
        };
      }

      if (
        reference ===
        "internal:workspaceBilling.getWorkspaceBillingSummaryFromMutation"
      ) {
        return {
          allowedActions: {
            canCancelPendingInvoice: false,
            canCreateCheckout: false,
            canRefreshPendingInvoice: true,
            canViewInvoices: true,
          },
          currentSubscription: null,
          pendingInvoice: {
            amount: 150000,
            currency: "IDR",
            invoiceId: "invoice_pending",
            issuedAt: 1_900_000_000_000,
            paymentUrl: "https://mayar.example/invoice/pending",
            pollAttempts: 1,
            provider: "mayar",
            providerInvoiceId: "mayar_invoice_pending",
            providerStatusText: "unpaid",
            status: "pending",
          },
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
        };
      }

      throw new Error(`Unexpected runQuery call: ${reference}`);
    });

    const result = await getHandler(refreshWorkspacePendingInvoice)(
      {
        runAction,
        runMutation,
        runQuery,
      } as never,
      {
        workspaceId: "workspace_123456" as never,
      },
    );

    expect(runQuery).toHaveBeenNthCalledWith(
      1,
      "internal:workspaceBilling.getPendingInvoiceForRefresh",
      { workspaceId: "workspace_123456" },
    );
    expect(runQuery).toHaveBeenNthCalledWith(
      2,
      "internal:workspaceBilling.getWorkspaceBillingSummaryFromMutation",
      {
        role: "superadmin",
        workspaceId: "workspace_123456",
      },
    );
    expect(result).toEqual(
      expect.objectContaining({
        pendingInvoice: expect.objectContaining({
          invoiceId: "invoice_pending",
          status: "pending",
        }),
        workspaceId: "workspace_123456",
      }),
    );
  });

  it("reconciles pending invoices and activates paid workspaces", async () => {
    const { reconcilePendingWorkspaceInvoices } =
      await import("../convex/workspaceBilling");
    const runQuery = vi.fn(async (reference: string) => {
      if (
        reference ===
        "internal:workspaceBilling.listPendingInvoicesForReconciliation"
      ) {
        return [
          {
            invoiceId: "invoice_paid",
            subscriptionId: "subscription_paid",
            providerInvoiceId: "mayar_invoice_paid",
            workspaceId: "workspace_paid",
          },
          {
            invoiceId: "invoice_pending",
            subscriptionId: "subscription_pending",
            providerInvoiceId: "mayar_invoice_pending",
            workspaceId: "workspace_pending",
          },
        ];
      }

      throw new Error(`Unexpected runQuery call: ${reference}`);
    });
    const markInvoiceFromProvider = vi.fn(
      async (args: Record<string, unknown>) => ({
        invoice: {
          amount: 150000,
          currency: "IDR",
          invoiceId: args.invoiceId,
          issuedAt: 1_900_000_000_000,
          paidAt:
            args.providerStatusText === "paid" ? 1_900_000_100_000 : undefined,
          pollAttempts: 1,
          provider: "mayar",
          providerInvoiceId: args.providerInvoiceId,
          status: args.providerStatusText === "paid" ? "paid" : "pending",
        },
        subscription: {
          kind: "pro_one_time",
          provider: "mayar",
          startedAt: 1_900_000_000_000,
          status: "pending",
          subscriptionId: args.subscriptionId,
          updatedAt: 1_900_000_000_000,
        },
        workspaceId: args.workspaceId,
      }),
    );
    const activatePaidWorkspacePeriod = vi.fn(
      async (...args: [Record<string, unknown>]) => {
        void args;
        return null;
      },
    );
    const runMutation = vi.fn(
      async (reference: string, args: Record<string, unknown>) => {
        if (reference === "internal:workspaceBilling.markInvoiceFromProvider") {
          return await markInvoiceFromProvider(args);
        }

        if (
          reference === "internal:workspaceBilling.activatePaidWorkspacePeriod"
        ) {
          return await activatePaidWorkspacePeriod(args);
        }

        throw new Error(`Unexpected runMutation call: ${reference}`);
      },
    );
    const runAction = vi.fn(
      async (reference: string, args: Record<string, unknown>) => {
        if (
          reference !== "internal:workspaceBillingMayar.fetchMayarInvoiceStatus"
        ) {
          throw new Error(`Unexpected runAction call: ${reference}`);
        }

        return args.providerInvoiceId === "mayar_invoice_paid"
          ? {
              amount: 150000,
              expiresAt: 1_900_003_600_000,
              paidAt: 1_900_000_100_000,
              paymentUrl: "https://mayar.example/invoice/paid",
              providerInvoiceId: "mayar_invoice_paid",
              providerStatusText: "paid",
              providerTransactionId: "mayar_txn_paid",
              rawProviderSnapshot: { id: "mayar_invoice_paid", status: "paid" },
            }
          : {
              amount: 150000,
              expiresAt: 1_900_003_600_000,
              paymentUrl: "https://mayar.example/invoice/pending",
              providerInvoiceId: "mayar_invoice_pending",
              providerStatusText: "unpaid",
              rawProviderSnapshot: {
                id: "mayar_invoice_pending",
                status: "unpaid",
              },
            };
      },
    );

    const result = await getHandler(reconcilePendingWorkspaceInvoices)(
      {
        runAction,
        runMutation,
        runQuery,
      } as never,
      {},
    );

    expect(runQuery).toHaveBeenCalledWith(
      "internal:workspaceBilling.listPendingInvoicesForReconciliation",
      {},
    );
    expect(activatePaidWorkspacePeriod).toHaveBeenCalledWith({
      paidAt: 1_900_000_100_000,
      subscriptionId: "subscription_paid",
      workspaceId: "workspace_paid",
    });
    expect(result).toEqual({
      expiredCount: 0,
      paidCount: 1,
      processedCount: 2,
    });
  });

  it("releases stale pending_initializing invoices during reconciliation when provider reference is missing", async () => {
    const { reconcilePendingWorkspaceInvoices } =
      await import("../convex/workspaceBilling");
    const finalizeWorkspaceCheckoutFailure = vi.fn(
      async (...args: [Record<string, unknown>]) => {
        void args;
        return null;
      },
    );
    const runQuery = vi.fn(async (reference: string) => {
      if (
        reference ===
        "internal:workspaceBilling.listPendingInvoicesForReconciliation"
      ) {
        return [
          {
            invoiceId: "invoice_initializing",
            subscriptionId: "subscription_initializing",
            workspaceId: "workspace_123456",
          },
        ];
      }

      throw new Error(`Unexpected runQuery call: ${reference}`);
    });
    const runMutation = vi.fn(
      async (reference: string, args: Record<string, unknown>) => {
        if (
          reference ===
          "internal:workspaceBilling.finalizeWorkspaceCheckoutFailure"
        ) {
          return await finalizeWorkspaceCheckoutFailure(args);
        }

        throw new Error(`Unexpected runMutation call: ${reference}`);
      },
    );
    const runAction = vi.fn();

    const result = await getHandler(reconcilePendingWorkspaceInvoices)(
      {
        runAction,
        runMutation,
        runQuery,
      } as never,
      {},
    );

    expect(runAction).not.toHaveBeenCalled();
    expect(finalizeWorkspaceCheckoutFailure).toHaveBeenCalledWith({
      invoiceId: "invoice_initializing",
      providerStatusText:
        "Sinkronisasi invoice Mayar terhenti sebelum referensi pembayaran tersedia.",
      subscriptionId: "subscription_initializing",
      workspaceId: "workspace_123456",
    });
    expect(result).toEqual({
      expiredCount: 0,
      paidCount: 0,
      processedCount: 1,
    });
  });

  it("returns invoice detail with workspace and stored Mayar customer data", async () => {
    const { getWorkspaceBillingInvoiceDetail } =
      await import("../convex/workspaceBilling");
    const workspace = {
      _id: "workspace_123456",
      slug: "workspace-demo",
      name: "Workspace Demo",
      plan: "pro",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    };
    const subscription = {
      _id: "subscription_active",
      workspaceId: "workspace_123456",
      status: "active",
      provider: "mayar",
      kind: "pro_one_time",
      startedAt: 1_900_000_000_000,
      activatedAt: 1_900_000_100_000,
      currentPeriodStartsAt: 1_900_000_100_000,
      currentPeriodEndsAt: 1_902_592_100_000,
      updatedAt: 1_900_000_100_000,
    };
    const invoice = {
      _id: "invoice_paid_123",
      workspaceId: "workspace_123456",
      subscriptionId: "subscription_active",
      provider: "mayar",
      providerInvoiceId: "mayar_invoice_paid_123",
      providerTransactionId: "mayar_txn_paid_123",
      status: "paid",
      amount: 150000,
      currency: "IDR",
      issuedAt: 1_900_000_000_000,
      paidAt: 1_900_000_100_000,
      coveredPeriodStartsAt: 1_900_000_100_000,
      coveredPeriodEndsAt: 1_902_592_100_000,
      pollAttempts: 1,
      providerStatusText: "paid",
    };
    const ctx = {
      db: {
        get: vi.fn(async (id: string) => {
          if (id === "workspace_123456") {
            return workspace;
          }

          if (id === "invoice_paid_123") {
            return invoice;
          }

          if (id === "subscription_active") {
            return subscription;
          }

          return null;
        }),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn(
            (
              indexName: string,
              builder: (query: {
                eq: (field: string, value: unknown) => unknown;
              }) => unknown,
            ) => {
              const filters: Record<string, unknown> = {};
              const queryBuilder = {
                eq(field: string, value: unknown) {
                  filters[field] = value;
                  return queryBuilder;
                },
              };
              builder(queryBuilder);

              if (
                table === "workspace_billing_customers" &&
                indexName === "by_workspace_provider"
              ) {
                return {
                  unique: vi.fn(async () => ({
                    workspaceId: "workspace_123456",
                    provider: "mayar",
                    providerCustomerId: "mayar_customer_123",
                    name: "Owner Workspace",
                    email: "owner@absenin.id",
                    phone: "+6281234567890",
                  })),
                };
              }

              if (table === "settings" && indexName === "by_workspace") {
                return {
                  unique: vi.fn(async () => ({
                    workspaceId: "workspace_123456",
                    timezone: "Asia/Jakarta",
                  })),
                };
              }

              throw new Error(
                `Unexpected table/index combination: ${table}/${indexName}`,
              );
            },
          ),
        })),
      },
    };

    const result = (await getHandler(getWorkspaceBillingInvoiceDetail)(
      ctx as never,
      {
        invoiceId: "invoice_paid_123" as never,
        workspaceId: "workspace_123456" as never,
      },
    )) as {
      customer: { name: string } | null;
      invoice: { invoiceId: string; status: string };
      subscription: { subscriptionId: string } | null;
      workspace: { id: string; name: string; plan: string };
    };

    expect(result.workspace).toEqual({
      id: "workspace_123456",
      name: "Workspace Demo",
      plan: "pro",
      timezone: "Asia/Jakarta",
    });
    expect(result.invoice).toEqual(
      expect.objectContaining({
        invoiceId: "invoice_paid_123",
        status: "paid",
      }),
    );
    expect(result.subscription).toEqual(
      expect.objectContaining({
        subscriptionId: "subscription_active",
      }),
    );
    expect(result.customer).toEqual(
      expect.objectContaining({
        name: "Owner Workspace",
      }),
    );
  });

  it("does not allow refreshing a checkout that is still pending initialization", async () => {
    const { getWorkspaceBillingSummary } =
      await import("../convex/workspaceBilling");
    const workspace = {
      _id: "workspace_123456",
      slug: "workspace",
      name: "Workspace",
      plan: "free",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    };
    const subscriptions = [
      {
        _id: "subscription_pending",
        workspaceId: "workspace_123456",
        status: "pending",
        provider: "mayar",
        kind: "pro_one_time",
        startedAt: 1_900_000_000_000,
        updatedAt: 1_900_000_000_000,
      },
    ];
    const invoices = [
      {
        _id: "invoice_initializing",
        workspaceId: "workspace_123456",
        subscriptionId: "subscription_pending",
        provider: "mayar",
        status: "pending_initializing",
        amount: 150000,
        currency: "IDR",
        issuedAt: 1_900_000_000_000,
        pollAttempts: 0,
      },
    ];
    const ctx = {
      db: {
        get: vi.fn(async (id: string) => {
          if (id === "workspace_123456") {
            return workspace;
          }

          return null;
        }),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn(
            (
              indexName: string,
              builder: (query: {
                eq: (field: string, value: unknown) => unknown;
              }) => unknown,
            ) => {
              const filters: Record<string, unknown> = {};
              const queryBuilder = {
                eq(field: string, value: unknown) {
                  filters[field] = value;
                  return queryBuilder;
                },
              };
              builder(queryBuilder);

              if (table === "workspace_subscriptions") {
                return {
                  collect: vi.fn(async () => {
                    if (indexName === "by_workspace_status") {
                      return subscriptions.filter(
                        (row) =>
                          row.workspaceId === filters.workspaceId &&
                          row.status === filters.status,
                      );
                    }

                    return subscriptions.filter(
                      (row) => row.workspaceId === filters.workspaceId,
                    );
                  }),
                };
              }

              if (table === "workspace_billing_invoices") {
                return {
                  collect: vi.fn(async () =>
                    invoices.filter(
                      (row) =>
                        row.workspaceId === filters.workspaceId &&
                        row.status === filters.status,
                    ),
                  ),
                };
              }

              throw new Error(
                `Unexpected table/index combination: ${table}/${indexName}`,
              );
            },
          ),
        })),
      },
    };

    const result = (await getHandler(getWorkspaceBillingSummary)(ctx as never, {
      workspaceId: "workspace_123456" as never,
    })) as Record<string, unknown> & {
      checkoutOffer: {
        amount: number;
        currency: string;
        periodDays: number;
        plan: string;
      };
      pendingInvoice: Record<string, unknown> | null;
      allowedActions: {
        canCancelPendingInvoice: boolean;
        canCreateCheckout: boolean;
        canRefreshPendingInvoice: boolean;
      };
    };

    expect(result.pendingInvoice).toEqual(
      expect.objectContaining({
        invoiceId: "invoice_initializing",
        status: "pending_initializing",
      }),
    );
    expect(result.allowedActions.canCancelPendingInvoice).toBe(true);
    expect(result.allowedActions.canCreateCheckout).toBe(false);
    expect(result.allowedActions.canRefreshPendingInvoice).toBe(false);
    expect(result.checkoutOffer).toEqual({
      amount: 150000,
      currency: "IDR",
      periodDays: 30,
      plan: "pro",
    });
  });

  it("falls back to the default Pro price when env input is empty or invalid", async () => {
    process.env.WORKSPACE_PRO_PRICE_IDR = "abc";
    const { getWorkspaceBillingSummary } =
      await import("../convex/workspaceBilling");
    const workspace = {
      _id: "workspace_123456",
      slug: "workspace",
      name: "Workspace",
      plan: "free",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    };
    const ctx = {
      db: {
        get: vi.fn(async (id: string) => {
          if (id === "workspace_123456") {
            return workspace;
          }

          return null;
        }),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn(
            (
              _indexName: string,
              builder: (query: {
                eq: (field: string, value: unknown) => unknown;
              }) => unknown,
            ) => {
              const queryBuilder = {
                eq() {
                  return queryBuilder;
                },
              };
              builder(queryBuilder);

              if (table === "workspace_subscriptions") {
                return {
                  collect: vi.fn(async () => []),
                };
              }

              if (table === "workspace_billing_invoices") {
                return {
                  collect: vi.fn(async () => []),
                };
              }

              throw new Error(`Unexpected table: ${table}`);
            },
          ),
        })),
      },
    };

    const result = (await getHandler(getWorkspaceBillingSummary)(ctx as never, {
      workspaceId: "workspace_123456" as never,
    })) as {
      checkoutOffer: {
        amount: number;
      };
    };

    expect(result.checkoutOffer.amount).toBe(150000);
  });

  it("does not mark over-limit free workspaces as restricted when billing never activated", async () => {
    const { getWorkspaceBillingSummary } =
      await import("../convex/workspaceBilling");
    getWorkspaceSubscriptionSummary.mockResolvedValueOnce({
      usage: {
        activeDevices: 2,
        activeMembers: 8,
      },
    });
    const workspace = {
      _id: "workspace_123456",
      slug: "workspace",
      name: "Workspace",
      plan: "free",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    };
    const subscriptions = [
      {
        _id: "subscription_pending_only",
        workspaceId: "workspace_123456",
        status: "pending",
        provider: "mayar",
        kind: "pro_one_time",
        startedAt: 1_900_000_000_000,
        updatedAt: 1_900_000_000_000,
      },
    ];
    const ctx = {
      db: {
        get: vi.fn(async (id: string) => {
          if (id === "workspace_123456") {
            return workspace;
          }

          return null;
        }),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn(
            (
              indexName: string,
              builder: (query: {
                eq: (field: string, value: unknown) => unknown;
              }) => unknown,
            ) => {
              const filters: Record<string, unknown> = {};
              const queryBuilder = {
                eq(field: string, value: unknown) {
                  filters[field] = value;
                  return queryBuilder;
                },
              };
              builder(queryBuilder);

              if (table === "workspace_subscriptions") {
                return {
                  collect: vi.fn(async () => {
                    if (indexName === "by_workspace_status") {
                      return subscriptions.filter(
                        (row) =>
                          row.workspaceId === filters.workspaceId &&
                          row.status === filters.status,
                      );
                    }

                    return subscriptions.filter(
                      (row) => row.workspaceId === filters.workspaceId,
                    );
                  }),
                };
              }

              if (table === "workspace_billing_invoices") {
                return {
                  collect: vi.fn(async () => []),
                };
              }

              throw new Error(
                `Unexpected table/index combination: ${table}/${indexName}`,
              );
            },
          ),
        })),
      },
    };

    const result = (await getHandler(getWorkspaceBillingSummary)(ctx as never, {
      workspaceId: "workspace_123456" as never,
    })) as {
      restrictedState: {
        hadPaidOrManualEntitlement: boolean;
        isRestricted: boolean;
      };
    };

    expect(result.restrictedState.hadPaidOrManualEntitlement).toBe(false);
    expect(result.restrictedState.isRestricted).toBe(false);
  });

  it("does not mark expired unpaid billing history as prior entitlement", async () => {
    const { getWorkspaceBillingSummary } =
      await import("../convex/workspaceBilling");
    getWorkspaceSubscriptionSummary.mockResolvedValueOnce({
      usage: {
        activeDevices: 2,
        activeMembers: 8,
      },
    });
    const workspace = {
      _id: "workspace_123456",
      slug: "workspace",
      name: "Workspace",
      plan: "free",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    };
    const subscriptions = [
      {
        _id: "subscription_expired_unpaid",
        workspaceId: "workspace_123456",
        status: "expired",
        provider: "mayar",
        kind: "pro_one_time",
        startedAt: 1_900_000_000_000,
        expiredAt: 1_900_003_600_000,
        updatedAt: 1_900_003_600_000,
      },
    ];
    const ctx = {
      db: {
        get: vi.fn(async (id: string) => {
          if (id === "workspace_123456") {
            return workspace;
          }

          return null;
        }),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn(
            (
              indexName: string,
              builder: (query: {
                eq: (field: string, value: unknown) => unknown;
              }) => unknown,
            ) => {
              const filters: Record<string, unknown> = {};
              const queryBuilder = {
                eq(field: string, value: unknown) {
                  filters[field] = value;
                  return queryBuilder;
                },
              };
              builder(queryBuilder);

              if (table === "workspace_subscriptions") {
                return {
                  collect: vi.fn(async () => {
                    if (indexName === "by_workspace_status") {
                      return subscriptions.filter(
                        (row) =>
                          row.workspaceId === filters.workspaceId &&
                          row.status === filters.status,
                      );
                    }

                    return subscriptions.filter(
                      (row) => row.workspaceId === filters.workspaceId,
                    );
                  }),
                };
              }

              if (table === "workspace_billing_invoices") {
                return {
                  collect: vi.fn(async () => []),
                };
              }

              throw new Error(
                `Unexpected table/index combination: ${table}/${indexName}`,
              );
            },
          ),
        })),
      },
    };

    const result = (await getHandler(getWorkspaceBillingSummary)(ctx as never, {
      workspaceId: "workspace_123456" as never,
    })) as {
      restrictedState: {
        hadPaidOrManualEntitlement: boolean;
        isRestricted: boolean;
      };
    };

    expect(result.restrictedState.hadPaidOrManualEntitlement).toBe(false);
    expect(result.restrictedState.isRestricted).toBe(false);
  });

  it("queries pending reconciliation rows through global status indexes", async () => {
    const { listPendingInvoicesForReconciliation } =
      await import("../convex/workspaceBilling");
    const queryCalls: Array<Record<string, unknown>> = [];
    const staleCutoff = 1_900_000_000_000 - 10 * 60 * 1000;
    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          if (table !== "workspace_billing_invoices") {
            throw new Error(`Unexpected table: ${table}`);
          }

          return {
            withIndex: vi.fn(
              (
                indexName: string,
                builder: (query: {
                  eq: (field: string, value: unknown) => unknown;
                  lte: (field: string, value: unknown) => unknown;
                }) => unknown,
              ) => {
                const filters: Record<string, unknown> = { indexName };
                const queryBuilder = {
                  eq(field: string, value: unknown) {
                    filters[field] = value;
                    return queryBuilder;
                  },
                  lte(field: string, value: unknown) {
                    filters[`${field}Lte`] = value;
                    return queryBuilder;
                  },
                };
                builder(queryBuilder);
                queryCalls.push(filters);

                return {
                  collect: vi.fn(async () => {
                    if (filters.status === "pending_initializing") {
                      expect(filters.issuedAtLte).toBe(staleCutoff);
                      return [
                        {
                          _id: "invoice_initializing",
                          subscriptionId: "subscription_initializing",
                          workspaceId: "workspace_123456",
                          status: "pending_initializing",
                          issuedAt: staleCutoff,
                        },
                      ];
                    }

                    return [
                      {
                        _id: "invoice_pending",
                        subscriptionId: "subscription_pending",
                        workspaceId: "workspace_123456",
                        providerInvoiceId: "mayar_invoice_pending",
                        status: "pending",
                        issuedAt: 1_900_000_000_000,
                      },
                    ];
                  }),
                };
              },
            ),
          };
        }),
      },
    };

    const result = await getHandler(listPendingInvoicesForReconciliation)(
      ctx as never,
      {},
    );

    expect(queryCalls).toEqual([
      expect.objectContaining({
        indexName: "by_status_issued_at",
        status: "pending_initializing",
      }),
      expect.objectContaining({
        indexName: "by_status_issued_at",
        status: "pending",
      }),
    ]);
    expect(result).toEqual([
      {
        invoiceId: "invoice_pending",
        subscriptionId: "subscription_pending",
        providerInvoiceId: "mayar_invoice_pending",
        workspaceId: "workspace_123456",
      },
      {
        invoiceId: "invoice_initializing",
        subscriptionId: "subscription_initializing",
        providerInvoiceId: undefined,
        workspaceId: "workspace_123456",
      },
    ]);
  });

  it("activates an internal enterprise entitlement without using Mayar", async () => {
    const { activateEnterpriseWorkspacePeriod } =
      await import("../convex/workspaceBilling");
    const workspace = {
      _id: "workspace_123456",
      slug: "workspace",
      name: "Workspace",
      plan: "free",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    };
    const subscriptions: Array<Record<string, unknown>> = [];
    const events: Array<Record<string, unknown>> = [];
    const ctx = {
      db: {
        get: vi.fn(async (id: string) => {
          if (id === "workspace_123456") {
            return workspace;
          }

          return subscriptions.find((row) => row._id === id) ?? null;
        }),
        insert: vi.fn(async (table: string, value: Record<string, unknown>) => {
          if (table === "workspace_subscriptions") {
            const row = { _id: "subscription_enterprise", ...value };
            subscriptions.push(row);
            return row._id;
          }

          if (table === "workspace_subscription_events") {
            events.push(value);
            return `event_${events.length}`;
          }

          throw new Error(`Unexpected insert table: ${table}`);
        }),
        patch: vi.fn(async (id: string, patch: Record<string, unknown>) => {
          if (id === "workspace_123456") {
            Object.assign(workspace, patch);
            return;
          }

          const row = subscriptions.find((item) => item._id === id);
          if (row) {
            Object.assign(row, patch);
          }
        }),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn(
            (
              indexName: string,
              builder: (query: {
                eq: (field: string, value: unknown) => unknown;
              }) => unknown,
            ) => {
              const filters: Record<string, unknown> = {};
              const queryBuilder = {
                eq(field: string, value: unknown) {
                  filters[field] = value;
                  return queryBuilder;
                },
              };
              builder(queryBuilder);

              if (table === "workspace_subscriptions") {
                return {
                  collect: vi.fn(async () => {
                    if (indexName === "by_workspace_status") {
                      return subscriptions.filter(
                        (row) =>
                          row.workspaceId === filters.workspaceId &&
                          row.status === filters.status,
                      );
                    }

                    return subscriptions.filter(
                      (row) => row.workspaceId === filters.workspaceId,
                    );
                  }),
                };
              }

              if (table === "workspace_billing_invoices") {
                return {
                  collect: vi.fn(async () => []),
                };
              }

              throw new Error(
                `Unexpected table/index combination: ${table}/${indexName}`,
              );
            },
          ),
        })),
      },
    };

    const result = (await getHandler(activateEnterpriseWorkspacePeriod)(
      ctx as never,
      {
        activatedAt: 1_900_000_100_000,
        createdByUserId: "user_superadmin" as never,
        currentPeriodEndsAt: 1_902_592_100_000,
        workspaceId: "workspace_123456" as never,
      },
    )) as { plan: string };

    expect(workspace.plan).toBe("enterprise");
    expect(subscriptions).toEqual([
      expect.objectContaining({
        kind: "enterprise_manual",
        provider: "manual",
        status: "active",
      }),
    ]);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "enterprise_activated",
          workspaceId: "workspace_123456",
        }),
      ]),
    );
    expect(result.plan).toBe("enterprise");
  });

  it("cancels an active internal enterprise entitlement and downgrades the workspace", async () => {
    const { cancelEnterpriseWorkspacePeriod } =
      await import("../convex/workspaceBilling");
    const workspace = {
      _id: "workspace_123456",
      slug: "workspace",
      name: "Workspace",
      plan: "enterprise",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    };
    const subscriptions: Array<Record<string, unknown>> = [
      {
        _id: "subscription_enterprise",
        workspaceId: "workspace_123456",
        status: "active",
        provider: "manual",
        kind: "enterprise_manual",
        startedAt: 1_900_000_000_000,
        activatedAt: 1_900_000_000_000,
        currentPeriodStartsAt: 1_900_000_000_000,
        currentPeriodEndsAt: 1_902_592_100_000,
        createdByUserId: "user_superadmin",
        updatedAt: 1_900_000_000_000,
      },
    ];
    const events: Array<Record<string, unknown>> = [];
    const ctx = {
      db: {
        get: vi.fn(async (id: string) => {
          if (id === "workspace_123456") {
            return workspace;
          }

          return subscriptions.find((row) => row._id === id) ?? null;
        }),
        insert: vi.fn(async (table: string, value: Record<string, unknown>) => {
          if (table === "workspace_subscription_events") {
            events.push(value);
            return `event_${events.length}`;
          }

          throw new Error(`Unexpected insert table: ${table}`);
        }),
        patch: vi.fn(async (id: string, patch: Record<string, unknown>) => {
          if (id === "workspace_123456") {
            Object.assign(workspace, patch);
            return;
          }

          const row = subscriptions.find((item) => item._id === id);
          if (row) {
            Object.assign(row, patch);
          }
        }),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn(
            (
              indexName: string,
              builder: (query: {
                eq: (field: string, value: unknown) => unknown;
              }) => unknown,
            ) => {
              const filters: Record<string, unknown> = {};
              const queryBuilder = {
                eq(field: string, value: unknown) {
                  filters[field] = value;
                  return queryBuilder;
                },
              };
              builder(queryBuilder);

              if (table === "workspace_subscriptions") {
                return {
                  collect: vi.fn(async () => {
                    if (indexName === "by_workspace_status") {
                      return subscriptions.filter(
                        (row) =>
                          row.workspaceId === filters.workspaceId &&
                          row.status === filters.status,
                      );
                    }

                    return subscriptions.filter(
                      (row) => row.workspaceId === filters.workspaceId,
                    );
                  }),
                };
              }

              if (table === "workspace_billing_invoices") {
                return {
                  collect: vi.fn(async () => []),
                };
              }

              throw new Error(
                `Unexpected table/index combination: ${table}/${indexName}`,
              );
            },
          ),
        })),
      },
    };

    const result = (await getHandler(cancelEnterpriseWorkspacePeriod)(
      ctx as never,
      {
        canceledAt: 1_900_500_000_000,
        workspaceId: "workspace_123456" as never,
      },
    )) as { plan: string };

    expect(workspace.plan).toBe("free");
    expect(subscriptions).toEqual([
      expect.objectContaining({
        canceledAt: 1_900_500_000_000,
        status: "canceled",
      }),
    ]);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "enterprise_canceled",
          workspaceId: "workspace_123456",
        }),
      ]),
    );
    expect(result.plan).toBe("free");
  });

  it("expires active workspace periods whose end date has passed", async () => {
    const { expireActiveWorkspacePeriods, listExpiredActiveWorkspacePeriods } =
      await import("../convex/workspaceBilling");
    const runQuery = vi.fn(async (reference: string) => {
      if (
        reference ===
        "internal:workspaceBilling.listExpiredActiveWorkspacePeriods"
      ) {
        return [
          {
            currentPeriodEndsAt: 1_899_999_999_000,
            subscriptionId: "subscription_expired",
            workspaceId: "workspace_123456",
          },
        ];
      }

      throw new Error(`Unexpected runQuery call: ${reference}`);
    });
    const expireWorkspacePeriod = vi.fn(
      async (...args: [Record<string, unknown>]) => {
        void args;
        return null;
      },
    );
    const runMutation = vi.fn(
      async (reference: string, args: Record<string, unknown>) => {
        if (reference === "internal:workspaceBilling.expireWorkspacePeriod") {
          return await expireWorkspacePeriod(args);
        }

        throw new Error(`Unexpected runMutation call: ${reference}`);
      },
    );

    const result = await getHandler(expireActiveWorkspacePeriods)(
      {
        runMutation,
        runQuery,
      } as never,
      {},
    );

    expect(expireWorkspacePeriod).toHaveBeenCalledWith({
      expiredAt: 1_899_999_999_000,
      subscriptionId: "subscription_expired",
      workspaceId: "workspace_123456",
    });
    expect(result).toEqual({ processedCount: 1 });

    const queryCalls: Array<Record<string, unknown>> = [];
    const listCtx = {
      db: {
        query: vi.fn((table: string) => {
          if (table !== "workspace_subscriptions") {
            throw new Error(`Unexpected table: ${table}`);
          }

          return {
            withIndex: vi.fn(
              (
                indexName: string,
                builder: (query: {
                  eq: (field: string, value: unknown) => unknown;
                  lte: (field: string, value: unknown) => unknown;
                }) => unknown,
              ) => {
                const filters: Record<string, unknown> = { indexName };
                const queryBuilder = {
                  eq(field: string, value: unknown) {
                    filters[field] = value;
                    return queryBuilder;
                  },
                  lte(field: string, value: unknown) {
                    filters[`${field}Lte`] = value;
                    return queryBuilder;
                  },
                };
                builder(queryBuilder);
                queryCalls.push(filters);

                return {
                  collect: vi.fn(async () => [
                    {
                      _id: "subscription_expired",
                      workspaceId: "workspace_123456",
                      status: "active",
                      currentPeriodEndsAt: 1_899_999_999_000,
                    },
                  ]),
                };
              },
            ),
          };
        }),
      },
    };

    await expect(
      getHandler(listExpiredActiveWorkspacePeriods)(listCtx as never, {}),
    ).resolves.toEqual([
      {
        currentPeriodEndsAt: 1_899_999_999_000,
        subscriptionId: "subscription_expired",
        workspaceId: "workspace_123456",
      },
    ]);
    expect(queryCalls).toEqual([
      expect.objectContaining({
        indexName: "by_status_period_end",
        status: "active",
        currentPeriodEndsAtLte: 1_900_000_000_000,
      }),
    ]);
  });
});
