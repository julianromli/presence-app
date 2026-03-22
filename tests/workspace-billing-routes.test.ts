import { beforeEach, describe, expect, it, vi } from "vitest";

type RoleResult = { error: Response } | { session: { role: string } };

type SetupOptions = {
  billingRoleResult?: RoleResult;
  restrictionsRoleResult?: RoleResult;
  convexToken?: string | null;
  workspaceContext?: { error: Response } | { workspace: { workspaceId: string } };
  invoiceDetailQueryResult?: unknown;
  summaryQueryResult?: unknown;
  checkoutActionResult?: unknown;
  refreshActionResult?: unknown;
  invoicesQueryResult?: unknown;
  restrictionsQueryResult?: unknown;
};

function makeWorkspaceContext(options: SetupOptions) {
  if (options.workspaceContext) {
    return options.workspaceContext;
  }

  return { workspace: { workspaceId: "workspace_123456" } };
}

async function setupBillingRoutes(options: SetupOptions = {}) {
  vi.resetModules();

  const query = vi.fn(async (name: string) => {
    if (name === "workspaceBilling:getWorkspaceBillingSummary") {
      return (
        options.summaryQueryResult ?? {
          allowedActions: {
            canCreateCheckout: true,
            canRefreshPendingInvoice: true,
            canViewInvoices: true,
          },
          currentSubscription: null,
          pendingInvoice: null,
          plan: "free",
          restrictedState: {
            activeDevices: 1,
            activeMembers: 3,
            isRestricted: false,
            overFreeDeviceLimit: false,
            overFreeMemberLimit: false,
          },
          workspaceId: "workspace_123456",
        }
      );
    }

    if (name === "workspaceBilling:listWorkspaceBillingInvoices") {
      return (
        options.invoicesQueryResult ?? {
          invoices: [
            {
              amount: 150000,
              currency: "IDR",
              invoiceId: "invoice_paid_123",
              issuedAt: 1_900_000_000_000,
              paidAt: 1_900_000_100_000,
              pollAttempts: 1,
              provider: "mayar",
              providerInvoiceId: "mayar_invoice_paid_123",
              status: "paid",
            },
          ],
          workspaceId: "workspace_123456",
        }
      );
    }

    if (name === "workspaceBilling:getWorkspaceBillingInvoiceDetail") {
      return (
        options.invoiceDetailQueryResult ?? {
          customer: {
            email: "owner@absenin.id",
            name: "Owner Workspace",
            phone: "+6281234567890",
            providerCustomerId: "mayar_customer_123",
            workspaceId: "workspace_123456",
          },
          invoice: {
            amount: 150000,
            currency: "IDR",
            invoiceId: "invoice_paid_123",
            issuedAt: 1_900_000_000_000,
            paidAt: 1_900_000_100_000,
            pollAttempts: 1,
            provider: "mayar",
            providerInvoiceId: "mayar_invoice_paid_123",
            providerTransactionId: "mayar_txn_paid_123",
            status: "paid",
          },
          subscription: null,
          workspace: {
            id: "workspace_123456",
            name: "Workspace Demo",
            plan: "pro",
            timezone: "Asia/Jakarta",
          },
        }
      );
    }

    return (
      options.restrictionsQueryResult ?? {
        activeDeviceRows: [],
        activeDevices: 0,
        activeMemberRows: [],
        activeMembers: 0,
        canManageRecovery: false,
        hadPaidOrManualEntitlement: false,
        isRestricted: false,
        overFreeDeviceLimit: false,
        overFreeMemberLimit: false,
        workspaceId: "workspace_123456",
      }
    );
  });
  const action = vi.fn();
  action.mockImplementation(async (name?: string) => {
    if (!name) {
      return undefined;
    }

    if (name === "workspaceBilling:createWorkspaceCheckout") {
      return (
        options.checkoutActionResult ?? {
          invoice: {
            amount: 150000,
            currency: "IDR",
            invoiceId: "invoice_123",
            issuedAt: 1_900_000_000_000,
            pollAttempts: 0,
            provider: "mayar",
            status: "pending",
          },
          paymentUrl: "https://mayar.example/invoice/123",
          reused: false,
          workspaceId: "workspace_123456",
        }
      );
    }

    if (name === "workspaceBilling:refreshWorkspacePendingInvoice") {
      return (
        options.refreshActionResult ?? {
          allowedActions: {
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
            subscriptionId: "subscription_123",
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
        }
      );
    }

    throw new Error(`Unexpected action: ${name}`);
  });
  const getAuthedConvexHttpClient = vi.fn(() => ({ action, query }));
  const requireWorkspaceRoleApiFromDb = vi.fn(async (roles: readonly string[]) => {
    if (roles.includes("superadmin") && !roles.includes("admin")) {
      return options.billingRoleResult ?? { session: { role: "superadmin" } };
    }

    return options.restrictionsRoleResult ?? { session: { role: "admin" } };
  });

  vi.doMock("@/lib/auth", () => ({
    getConvexTokenOrNull: vi.fn(async () =>
      options.convexToken === undefined ? "convex-token" : options.convexToken,
    ),
    requireWorkspaceApiContext: vi.fn(() => makeWorkspaceContext(options)),
    requireWorkspaceRoleApiFromDb,
  }));
  vi.doMock("@/lib/convex-http", () => ({ getAuthedConvexHttpClient }));
  vi.doMock("@/lib/api-error", () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json({ code: "INTERNAL_ERROR", message: fallbackMessage }, { status: 500 }),
    ),
  }));

  const billingRouteModule = await import("../app/api/workspaces/current/billing/route");
  const restrictionsRouteModule = await import(
    "../app/api/workspaces/current/restrictions/route"
  );
  const checkoutRouteModule = await import(
    "../app/api/workspaces/current/billing/checkout/route"
  );
  const invoicesRouteModule = await import(
    "../app/api/workspaces/current/billing/invoices/route"
  );
  const invoiceDetailRouteModule = await import(
    "../app/api/workspaces/current/billing/invoices/[invoiceId]/route"
  );
  const refreshRouteModule = await import(
    "../app/api/workspaces/current/billing/refresh/route"
  );

  return {
      GETBilling: billingRouteModule.GET!,
      GETInvoiceDetail: invoiceDetailRouteModule.GET!,
      GETInvoices: invoicesRouteModule.GET!,
      GETRestrictions: restrictionsRouteModule.GET!,
      POSTCheckout: checkoutRouteModule.POST!,
    POSTRefresh: refreshRouteModule.POST!,
    mocks: { action, query, requireWorkspaceRoleApiFromDb },
  };
}

function expectResponse(value: Response | undefined) {
  expect(value).toBeDefined();
  return value as Response;
}

describe("workspace billing routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the billing summary for superadmin users", async () => {
    const { GETBilling, mocks } = await setupBillingRoutes();

    const response = expectResponse(await GETBilling(
      new Request("http://localhost/api/workspaces/current/billing", {
        headers: { "x-workspace-id": "workspace_123456" },
      }),
    ));

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith(
      "workspaceBilling:getWorkspaceBillingSummary",
      { workspaceId: "workspace_123456" },
    );
  });

  it("returns summary with refresh disabled for pending_initializing invoices", async () => {
    const { GETBilling } = await setupBillingRoutes({
      summaryQueryResult: {
        allowedActions: {
          canCreateCheckout: false,
          canRefreshPendingInvoice: false,
          canViewInvoices: true,
        },
        currentSubscription: null,
        pendingInvoice: {
          amount: 150000,
          currency: "IDR",
          invoiceId: "invoice_initializing",
          issuedAt: 1_900_000_000_000,
          pollAttempts: 0,
          provider: "mayar",
          status: "pending_initializing",
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
      },
    });

    const response = expectResponse(await GETBilling(
      new Request("http://localhost/api/workspaces/current/billing", {
        headers: { "x-workspace-id": "workspace_123456" },
      }),
    ));

    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        allowedActions: expect.objectContaining({
          canCreateCheckout: false,
          canRefreshPendingInvoice: false,
        }),
        pendingInvoice: expect.objectContaining({
          invoiceId: "invoice_initializing",
          status: "pending_initializing",
        }),
      }),
    );
  });

  it("allows admin users to load restriction data", async () => {
    const { GETRestrictions, mocks } = await setupBillingRoutes();

    const response = expectResponse(await GETRestrictions(
      new Request("http://localhost/api/workspaces/current/restrictions", {
        headers: { "x-workspace-id": "workspace_123456" },
      }),
    ));

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith(
      "workspaceBilling:getWorkspaceRestrictedExpiredState",
      { workspaceId: "workspace_123456" },
    );
  });

  it("hides member and device rows when the workspace is not restricted", async () => {
    const { GETRestrictions } = await setupBillingRoutes({
      restrictionsQueryResult: {
        activeDeviceRows: [],
        activeDevices: 3,
        activeMemberRows: [],
        activeMembers: 8,
        canManageRecovery: false,
        hadPaidOrManualEntitlement: false,
        isRestricted: false,
        overFreeDeviceLimit: true,
        overFreeMemberLimit: true,
        workspaceId: "workspace_123456",
      },
    });

    const response = expectResponse(await GETRestrictions(
      new Request("http://localhost/api/workspaces/current/restrictions", {
        headers: { "x-workspace-id": "workspace_123456" },
      }),
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      activeDeviceRows: [],
      activeDevices: 3,
      activeMemberRows: [],
      activeMembers: 8,
      canManageRecovery: false,
      hadPaidOrManualEntitlement: false,
      isRestricted: false,
      overFreeDeviceLimit: true,
      overFreeMemberLimit: true,
      workspaceId: "workspace_123456",
    });
  });

  it("returns invoice history for superadmin users", async () => {
    const { GETInvoices, mocks } = await setupBillingRoutes();

    const response = expectResponse(await GETInvoices(
      new Request("http://localhost/api/workspaces/current/billing/invoices", {
        headers: { "x-workspace-id": "workspace_123456" },
      }),
    ));

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith(
      "workspaceBilling:listWorkspaceBillingInvoices",
      { workspaceId: "workspace_123456" },
    );
  });

  it("returns invoice detail for superadmin users", async () => {
    const { GETInvoiceDetail, mocks } = await setupBillingRoutes();

    const response = expectResponse(await GETInvoiceDetail(
      new Request("http://localhost/api/workspaces/current/billing/invoices/invoice_paid_123", {
        headers: { "x-workspace-id": "workspace_123456" },
      }),
      {
        params: Promise.resolve({ invoiceId: "invoice_paid_123" }),
      },
    ));

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith(
      "workspaceBilling:getWorkspaceBillingInvoiceDetail",
      {
        invoiceId: "invoice_paid_123",
        workspaceId: "workspace_123456",
      },
    );
  });

  it("rejects invoice detail when invoiceId route param is empty", async () => {
    const { GETInvoiceDetail, mocks } = await setupBillingRoutes();

    const response = expectResponse(await GETInvoiceDetail(
      new Request("http://localhost/api/workspaces/current/billing/invoices/%20%20", {
        headers: { "x-workspace-id": "workspace_123456" },
      }),
      {
        params: Promise.resolve({ invoiceId: "   " }),
      },
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Field invoiceId wajib diisi.",
    });
    expect(mocks.query).not.toHaveBeenCalledWith(
      "workspaceBilling:getWorkspaceBillingInvoiceDetail",
      expect.anything(),
    );
  });

  it("blocks checkout creation when superadmin access fails", async () => {
    const forbidden = Response.json(
      { code: "FORBIDDEN", message: "Forbidden" },
      { status: 403 },
    );
    const { POSTCheckout, mocks } = await setupBillingRoutes({
      billingRoleResult: { error: forbidden },
    });

    const response = expectResponse(await POSTCheckout(
      new Request("http://localhost/api/workspaces/current/billing/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-workspace-id": "workspace_123456",
        },
        body: JSON.stringify({}),
      }),
    ));

    expect(response.status).toBe(403);
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("rejects checkout creation when billingPhone is missing", async () => {
    const { POSTCheckout, mocks } = await setupBillingRoutes();

    const response = expectResponse(await POSTCheckout(
      new Request("http://localhost/api/workspaces/current/billing/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-workspace-id": "workspace_123456",
        },
        body: JSON.stringify({}),
      }),
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Field billingPhone wajib berupa string.",
    });
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("rejects checkout creation when billingPhone contains too few digits", async () => {
    const { POSTCheckout, mocks } = await setupBillingRoutes();

    const response = expectResponse(await POSTCheckout(
      new Request("http://localhost/api/workspaces/current/billing/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-workspace-id": "workspace_123456",
        },
        body: JSON.stringify({ billingPhone: "0812" }),
      }),
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Field billingPhone harus berisi nomor WhatsApp yang valid.",
    });
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("forwards normalized billingPhone into checkout creation", async () => {
    const { POSTCheckout, mocks } = await setupBillingRoutes();

    const response = expectResponse(await POSTCheckout(
      new Request("http://localhost/api/workspaces/current/billing/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-workspace-id": "workspace_123456",
        },
        body: JSON.stringify({ billingPhone: "  +62 81234567890  " }),
      }),
    ));

    expect(response.status).toBe(200);
    expect(mocks.action).toHaveBeenCalledWith(
      "workspaceBilling:createWorkspaceCheckout",
      {
        billingPhone: "+62 81234567890",
        workspaceId: "workspace_123456",
      },
    );
  });

  it("refreshes the current pending invoice for superadmin users", async () => {
    const { POSTRefresh, mocks } = await setupBillingRoutes();

    const response = expectResponse(await POSTRefresh(
      new Request("http://localhost/api/workspaces/current/billing/refresh", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-workspace-id": "workspace_123456",
        },
        body: JSON.stringify({}),
      }),
    ));

    expect(response.status).toBe(200);
    expect(mocks.action).toHaveBeenCalledWith(
      "workspaceBilling:refreshWorkspacePendingInvoice",
      { workspaceId: "workspace_123456" },
    );
  });
});
