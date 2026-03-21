import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { requireWorkspaceRole } from "./helpers";
import { resolveWorkspacePlan, workspacePlanValidator } from "./plans";
import { getWorkspaceSubscriptionSummary } from "./workspaceSubscription";

const FREE_WORKSPACE_MEMBER_LIMIT = 5;
const FREE_WORKSPACE_DEVICE_LIMIT = 1;
const WORKSPACE_PRO_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const WORKSPACE_PRO_PRICE_IDR = Number.parseInt(
  process.env.WORKSPACE_PRO_PRICE_IDR ?? "150000",
  10,
);

const workspaceBillingProviderValidator = v.union(v.literal("mayar"), v.literal("manual"));
const workspaceSubscriptionKindValidator = v.union(
  v.literal("pro_one_time"),
  v.literal("enterprise_manual"),
);
const workspaceSubscriptionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("expired"),
  v.literal("canceled"),
);
const workspaceBillingInvoiceStatusValidator = v.union(
  v.literal("pending_initializing"),
  v.literal("pending"),
  v.literal("paid"),
  v.literal("expired"),
  v.literal("canceled"),
  v.literal("failed"),
);

const workspaceBillingAllowedActionsValidator = v.object({
  canCreateCheckout: v.boolean(),
  canRefreshPendingInvoice: v.boolean(),
  canViewInvoices: v.boolean(),
});

const workspaceBillingSubscriptionViewValidator = v.object({
  subscriptionId: v.string(),
  status: workspaceSubscriptionStatusValidator,
  provider: workspaceBillingProviderValidator,
  kind: workspaceSubscriptionKindValidator,
  startedAt: v.number(),
  activatedAt: v.optional(v.number()),
  currentPeriodStartsAt: v.optional(v.number()),
  currentPeriodEndsAt: v.optional(v.number()),
  expiredAt: v.optional(v.number()),
  canceledAt: v.optional(v.number()),
  updatedAt: v.number(),
});

const workspaceBillingInvoiceViewValidator = v.object({
  invoiceId: v.string(),
  subscriptionId: v.optional(v.string()),
  provider: v.literal("mayar"),
  providerInvoiceId: v.optional(v.string()),
  providerTransactionId: v.optional(v.string()),
  status: workspaceBillingInvoiceStatusValidator,
  amount: v.number(),
  currency: v.literal("IDR"),
  paymentUrl: v.optional(v.string()),
  issuedAt: v.number(),
  expiresAt: v.optional(v.number()),
  paidAt: v.optional(v.number()),
  coveredPeriodStartsAt: v.optional(v.number()),
  coveredPeriodEndsAt: v.optional(v.number()),
  lastPolledAt: v.optional(v.number()),
  pollAttempts: v.number(),
  providerStatusText: v.optional(v.string()),
});

const workspaceRestrictedMemberRowValidator = v.object({
  membershipId: v.string(),
  userId: v.string(),
  name: v.string(),
  email: v.string(),
  role: v.union(
    v.literal("superadmin"),
    v.literal("admin"),
    v.literal("karyawan"),
    v.literal("device-qr"),
  ),
  isActive: v.boolean(),
  isCurrentUser: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const workspaceRestrictedDeviceRowValidator = v.object({
  deviceId: v.string(),
  label: v.string(),
  status: v.union(v.literal("active"), v.literal("revoked")),
  online: v.boolean(),
  lastSeenAt: v.optional(v.number()),
  claimedAt: v.number(),
});

const workspaceRestrictedSummaryValidator = v.object({
  isRestricted: v.boolean(),
  hadPaidOrManualEntitlement: v.boolean(),
  overFreeMemberLimit: v.boolean(),
  overFreeDeviceLimit: v.boolean(),
  activeMembers: v.number(),
  activeDevices: v.number(),
});

const workspaceBillingSummaryValidator = v.object({
  workspaceId: v.string(),
  plan: workspacePlanValidator,
  currentSubscription: v.union(v.null(), workspaceBillingSubscriptionViewValidator),
  pendingInvoice: v.union(v.null(), workspaceBillingInvoiceViewValidator),
  restrictedState: workspaceRestrictedSummaryValidator,
  allowedActions: workspaceBillingAllowedActionsValidator,
});

const workspaceBillingInvoicesValidator = v.object({
  workspaceId: v.string(),
  invoices: v.array(workspaceBillingInvoiceViewValidator),
});

const workspaceRestrictedStateValidator = v.object({
  workspaceId: v.string(),
  isRestricted: v.boolean(),
  hadPaidOrManualEntitlement: v.boolean(),
  overFreeMemberLimit: v.boolean(),
  overFreeDeviceLimit: v.boolean(),
  activeMembers: v.number(),
  activeDevices: v.number(),
  canManageRecovery: v.boolean(),
  activeMemberRows: v.array(workspaceRestrictedMemberRowValidator),
  activeDeviceRows: v.array(workspaceRestrictedDeviceRowValidator),
});

const workspaceCheckoutPayloadValidator = v.object({
  workspaceId: v.string(),
  reused: v.boolean(),
  paymentUrl: v.optional(v.string()),
  invoice: workspaceBillingInvoiceViewValidator,
});

const providerInvoiceUpdateResultValidator = v.object({
  workspaceId: v.string(),
  invoice: workspaceBillingInvoiceViewValidator,
  subscription: workspaceBillingSubscriptionViewValidator,
});

const pendingInvoiceReconciliationRowValidator = v.object({
  invoiceId: v.id("workspace_billing_invoices"),
  subscriptionId: v.id("workspace_subscriptions"),
  providerInvoiceId: v.optional(v.string()),
  workspaceId: v.id("workspaces"),
});

const expiredActiveWorkspacePeriodRowValidator = v.object({
  currentPeriodEndsAt: v.number(),
  subscriptionId: v.id("workspace_subscriptions"),
  workspaceId: v.id("workspaces"),
});

const reconcilePendingWorkspaceInvoicesResultValidator = v.object({
  expiredCount: v.number(),
  paidCount: v.number(),
  processedCount: v.number(),
});

const expireActiveWorkspacePeriodsResultValidator = v.object({
  processedCount: v.number(),
});

const reserveWorkspaceCheckoutResultValidator = v.union(
  workspaceCheckoutPayloadValidator,
  v.object({
    workspaceId: v.string(),
    subscriptionId: v.string(),
    invoiceId: v.string(),
    invoiceIssuedAt: v.number(),
    createdByUserId: v.optional(v.string()),
  }),
);

const storedMayarCustomerValidator = v.object({
  workspaceId: v.string(),
  providerCustomerId: v.string(),
  name: v.string(),
  email: v.string(),
  phone: v.string(),
});

function buildBillingError(code, message, data) {
  return new ConvexError({ code, message, ...(data ?? {}) });
}

function ensureActiveWorkspace(workspace, workspaceId) {
  if (!workspace || !workspace.isActive) {
    throw buildBillingError("WORKSPACE_INVALID", "Workspace tidak valid.", {
      workspaceId,
    });
  }

  return workspace;
}

function toSubscriptionView(row) {
  if (!row) {
    return null;
  }

  return {
    subscriptionId: String(row._id),
    status: row.status,
    provider: row.provider,
    kind: row.kind,
    startedAt: row.startedAt,
    activatedAt: row.activatedAt,
    currentPeriodStartsAt: row.currentPeriodStartsAt,
    currentPeriodEndsAt: row.currentPeriodEndsAt,
    expiredAt: row.expiredAt,
    canceledAt: row.canceledAt,
    updatedAt: row.updatedAt,
  };
}

function toInvoiceView(row) {
  if (!row) {
    return null;
  }

  return {
    invoiceId: String(row._id),
    subscriptionId: row.subscriptionId ? String(row.subscriptionId) : undefined,
    provider: row.provider,
    providerInvoiceId: row.providerInvoiceId,
    providerTransactionId: row.providerTransactionId,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    paymentUrl: row.paymentUrl,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    paidAt: row.paidAt,
    coveredPeriodStartsAt: row.coveredPeriodStartsAt,
    coveredPeriodEndsAt: row.coveredPeriodEndsAt,
    lastPolledAt: row.lastPolledAt,
    pollAttempts: row.pollAttempts,
    providerStatusText: row.providerStatusText,
  };
}

function buildRestrictedState({
  activeDevices,
  activeMembers,
  hadPaidOrManualEntitlement,
  plan,
}) {
  const overFreeMemberLimit = activeMembers > FREE_WORKSPACE_MEMBER_LIMIT;
  const overFreeDeviceLimit = activeDevices > FREE_WORKSPACE_DEVICE_LIMIT;

  return {
    isRestricted:
      plan === "free" &&
      hadPaidOrManualEntitlement &&
      (overFreeMemberLimit || overFreeDeviceLimit),
    hadPaidOrManualEntitlement,
    overFreeMemberLimit,
    overFreeDeviceLimit,
    activeMembers,
    activeDevices,
  };
}

function mapMayarInvoiceStatus({ expiresAt, now = Date.now(), providerStatus }) {
  const normalizedStatus = providerStatus?.trim().toLowerCase();

  if (normalizedStatus === "paid") {
    return "paid";
  }

  if (
    normalizedStatus === "closed" ||
    normalizedStatus === "canceled" ||
    normalizedStatus === "cancelled"
  ) {
    return "canceled";
  }

  if (normalizedStatus === "failed") {
    return "failed";
  }

  if (
    normalizedStatus === "unpaid" ||
    normalizedStatus === "created" ||
    normalizedStatus === "open" ||
    normalizedStatus === "active" ||
    normalizedStatus === undefined
  ) {
    if (typeof expiresAt === "number" && expiresAt <= now) {
      return "expired";
    }

    return "pending";
  }

  if (typeof expiresAt === "number" && expiresAt <= now) {
    return "expired";
  }

  return "failed";
}

async function listInvoicesByStatuses(ctx, workspaceId, statuses) {
  if (workspaceId === undefined) {
    const rows = await ctx.db.query("workspace_billing_invoices").collect();
    return rows
      .filter((row) => statuses.includes(row.status))
      .sort((left, right) => right.issuedAt - left.issuedAt);
  }

  const groups = await Promise.all(
    statuses.map((status) =>
      ctx.db
        .query("workspace_billing_invoices")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", workspaceId).eq("status", status),
        )
        .collect(),
    ),
  );

  return groups.flat().sort((left, right) => right.issuedAt - left.issuedAt);
}

async function listSubscriptionRowsByWorkspace(ctx, workspaceId) {
  return await ctx.db
    .query("workspace_subscriptions")
    .withIndex("by_workspace_updated_at", (q) => q.eq("workspaceId", workspaceId))
    .collect();
}

async function getLatestSubscriptionByStatus(ctx, workspaceId, status) {
  const rows = await ctx.db
    .query("workspace_subscriptions")
    .withIndex("by_workspace_status", (q) =>
      q.eq("workspaceId", workspaceId).eq("status", status),
    )
    .collect();

  return rows.sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
}

async function getLatestOpenInvoice(ctx, workspaceId) {
  const rows = await listInvoicesByStatuses(ctx, workspaceId, [
    "pending_initializing",
    "pending",
  ]);
  return rows[0] ?? null;
}

async function getPendingInvoiceByWorkspace(ctx, workspaceId) {
  const invoice = await getLatestOpenInvoice(ctx, workspaceId);
  if (!invoice) {
    throw buildBillingError(
      "BILLING_INVOICE_NOT_FOUND",
      "Workspace tidak memiliki invoice pending.",
      { workspaceId },
    );
  }

  return invoice;
}

async function buildBillingSummary(ctx, workspaceId, role) {
  const workspace = ensureActiveWorkspace(await ctx.db.get(workspaceId), workspaceId);
  const [subscriptionSummary, activeSubscription, pendingInvoice, subscriptionRows] =
    await Promise.all([
      getWorkspaceSubscriptionSummary(ctx, workspace),
      getLatestSubscriptionByStatus(ctx, workspaceId, "active"),
      getLatestOpenInvoice(ctx, workspaceId),
      listSubscriptionRowsByWorkspace(ctx, workspaceId),
    ]);

  const restrictedState = buildRestrictedState({
    activeDevices: subscriptionSummary.usage.activeDevices,
    activeMembers: subscriptionSummary.usage.activeMembers,
    hadPaidOrManualEntitlement: subscriptionRows.length > 0,
    plan: resolveWorkspacePlan(workspace),
  });

  return {
    workspaceId: String(workspaceId),
    plan: resolveWorkspacePlan(workspace),
    currentSubscription: toSubscriptionView(activeSubscription),
    pendingInvoice: toInvoiceView(pendingInvoice),
    restrictedState,
    allowedActions: {
      canCreateCheckout:
        role === "superadmin" && !activeSubscription && pendingInvoice === null,
      canRefreshPendingInvoice:
        role === "superadmin" &&
        pendingInvoice !== null &&
        pendingInvoice.status === "pending" &&
        typeof pendingInvoice.providerInvoiceId === "string" &&
        pendingInvoice.providerInvoiceId.length > 0,
      canViewInvoices: role === "superadmin",
    },
  };
}

async function emitSubscriptionEvent(ctx, event) {
  await ctx.db.insert("workspace_subscription_events", event);
}

async function buildRestrictedRows(ctx, workspaceId, currentUserId) {
  const [memberships, devices] = await Promise.all([
    ctx.db
      .query("workspace_members")
      .withIndex("by_workspace_active", (q) =>
        q.eq("workspaceId", workspaceId).eq("isActive", true),
      )
      .collect(),
    ctx.db
      .query("devices")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", "active"),
      )
      .collect(),
  ]);

  const userRows = await Promise.all(
    memberships.map((membership) => ctx.db.get(membership.userId)),
  );

  return {
    activeMemberRows: memberships
      .map((membership, index) => {
        const user = userRows[index];
        if (!user) {
          return null;
        }

        return {
          membershipId: String(membership._id),
          userId: String(membership.userId),
          name: user.name,
          email: user.email,
          role: membership.role,
          isActive: membership.isActive,
          isCurrentUser: membership.userId === currentUserId,
          createdAt: membership.createdAt,
          updatedAt: membership.updatedAt,
        };
      })
      .filter(Boolean),
    activeDeviceRows: devices.map((device) => ({
      deviceId: String(device._id),
      label: device.label,
      status: device.status,
      online:
        typeof device.lastSeenAt === "number" &&
        Date.now() - device.lastSeenAt <= 5 * 60 * 1000,
      lastSeenAt: device.lastSeenAt,
      claimedAt: device.claimedAt,
    })),
  };
}

export const getWorkspaceBillingSummary = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: workspaceBillingSummaryValidator,
  handler: async (ctx, args) => {
    const { membership } = await requireWorkspaceRole(ctx, args.workspaceId, ["superadmin"]);
    return await buildBillingSummary(ctx, args.workspaceId, membership.role);
  },
});

export const listWorkspaceBillingInvoices = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: workspaceBillingInvoicesValidator,
  handler: async (ctx, args) => {
    await requireWorkspaceRole(ctx, args.workspaceId, ["superadmin"]);
    const rows = await ctx.db
      .query("workspace_billing_invoices")
      .withIndex("by_workspace_issued_at", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return {
      workspaceId: String(args.workspaceId),
      invoices: rows
        .sort((left, right) => right.issuedAt - left.issuedAt)
        .map((row) => toInvoiceView(row)),
    };
  },
});

export const getWorkspaceRestrictedExpiredState = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: workspaceRestrictedStateValidator,
  handler: async (ctx, args) => {
    const { user, membership } = await requireWorkspaceRole(ctx, args.workspaceId, [
      "superadmin",
      "admin",
    ]);
    const workspace = ensureActiveWorkspace(await ctx.db.get(args.workspaceId), args.workspaceId);
    const subscriptionSummary = await getWorkspaceSubscriptionSummary(ctx, workspace);
    const subscriptionRows = await listSubscriptionRowsByWorkspace(ctx, args.workspaceId);
    const restrictedState = buildRestrictedState({
      activeDevices: subscriptionSummary.usage.activeDevices,
      activeMembers: subscriptionSummary.usage.activeMembers,
      hadPaidOrManualEntitlement: subscriptionRows.length > 0,
      plan: resolveWorkspacePlan(workspace),
    });
    const rows = restrictedState.isRestricted
      ? await buildRestrictedRows(ctx, args.workspaceId, user._id)
      : { activeMemberRows: [], activeDeviceRows: [] };

    return {
      workspaceId: String(args.workspaceId),
      ...restrictedState,
      canManageRecovery: membership.role === "superadmin",
      activeMemberRows: rows.activeMemberRows,
      activeDeviceRows: rows.activeDeviceRows,
    };
  },
});

export const createWorkspaceCheckout = action({
  args: {
    workspaceId: v.id("workspaces"),
    billingPhone: v.string(),
  },
  returns: workspaceCheckoutPayloadValidator,
  handler: async (ctx, args) => {
    const { user } = await requireWorkspaceRole(ctx, args.workspaceId, ["superadmin"]);

    const reservation = await ctx.runMutation(internal.workspaceBilling.reserveWorkspaceCheckout, {
      billingPhone: args.billingPhone,
      createdByUserId: user._id,
      workspaceId: args.workspaceId,
    });

    if (reservation.reused) {
      return reservation;
    }

    try {
      const customer = await ctx.runAction(
        internal.workspaceBillingMayar.createMayarCustomerIfNeeded,
        {
          billingPhone: args.billingPhone,
          email: user.email,
          name: user.name,
          workspaceId: args.workspaceId,
        },
      );

      const providerInvoice = await ctx.runAction(
        internal.workspaceBillingMayar.createMayarInvoice,
        {
          amount: WORKSPACE_PRO_PRICE_IDR,
          billingPhone: args.billingPhone,
          customerEmail: customer.email,
          customerName: customer.name,
          invoiceId: reservation.invoiceId,
          providerCustomerId: customer.providerCustomerId,
          subscriptionId: reservation.subscriptionId,
          workspaceId: args.workspaceId,
        },
      );

      return await ctx.runMutation(
        internal.workspaceBilling.finalizeWorkspaceCheckoutSuccess,
        {
          expiresAt: providerInvoice.expiresAt,
          invoiceId: reservation.invoiceId,
          paymentUrl: providerInvoice.paymentUrl,
          providerInvoiceId: providerInvoice.providerInvoiceId,
          providerStatusText: providerInvoice.providerStatusText,
          providerTransactionId: providerInvoice.providerTransactionId,
          rawProviderSnapshot: providerInvoice.rawProviderSnapshot,
          subscriptionId: reservation.subscriptionId,
          workspaceId: args.workspaceId,
        },
      );
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : "Gagal membuat invoice Mayar.";
      const errorCode =
        error && typeof error === "object" && "data" in error && error.data && typeof error.data === "object"
          ? error.data.code
          : undefined;
      const isAmbiguousFailure = errorCode === "BILLING_SYNC_FAILED";

      if (!isAmbiguousFailure) {
        await ctx.runMutation(internal.workspaceBilling.finalizeWorkspaceCheckoutFailure, {
          invoiceId: reservation.invoiceId,
          providerStatusText: failureMessage,
          subscriptionId: reservation.subscriptionId,
          workspaceId: args.workspaceId,
        });
      }

      throw error;
    }
  },
});

export const refreshWorkspacePendingInvoice = action({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: workspaceBillingSummaryValidator,
  handler: async (ctx, args) => {
    const { membership } = await requireWorkspaceRole(ctx, args.workspaceId, ["superadmin"]);

    const pendingInvoice = await ctx.runQuery(internal.workspaceBilling.getPendingInvoiceForRefresh, {
      workspaceId: args.workspaceId,
    });

    if (!pendingInvoice.providerInvoiceId) {
      throw buildBillingError(
        "BILLING_SYNC_FAILED",
        "Invoice pending belum memiliki referensi provider.",
        { workspaceId: args.workspaceId },
      );
    }

    const providerStatus = await ctx.runAction(
      internal.workspaceBillingMayar.fetchMayarInvoiceStatus,
      {
        providerInvoiceId: pendingInvoice.providerInvoiceId,
      },
    );

    const invoiceUpdate = await ctx.runMutation(internal.workspaceBilling.markInvoiceFromProvider, {
      amount: providerStatus.amount,
      expiresAt: providerStatus.expiresAt,
      invoiceId: pendingInvoice.invoiceId,
      paidAt: providerStatus.paidAt,
      paymentUrl: providerStatus.paymentUrl,
      providerInvoiceId: providerStatus.providerInvoiceId,
      providerStatusText: providerStatus.providerStatusText,
      providerTransactionId: providerStatus.providerTransactionId,
      rawProviderSnapshot: providerStatus.rawProviderSnapshot,
      subscriptionId: pendingInvoice.subscriptionId,
      workspaceId: args.workspaceId,
    });

    if (invoiceUpdate.invoice.status === "paid") {
      return await ctx.runMutation(internal.workspaceBilling.activatePaidWorkspacePeriod, {
        paidAt: invoiceUpdate.invoice.paidAt ?? Date.now(),
        subscriptionId: pendingInvoice.subscriptionId,
        workspaceId: args.workspaceId,
      });
    }

    if (invoiceUpdate.invoice.status === "expired") {
      await ctx.runMutation(internal.workspaceBilling.expireWorkspacePeriod, {
        expiredAt: invoiceUpdate.invoice.expiresAt ?? Date.now(),
        subscriptionId: pendingInvoice.subscriptionId,
        workspaceId: args.workspaceId,
      });
    }

    return await buildBillingSummary(ctx, args.workspaceId, membership.role);
  },
});

export const getPendingInvoiceForRefresh = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: v.object({
    invoiceId: v.id("workspace_billing_invoices"),
    subscriptionId: v.id("workspace_subscriptions"),
    providerInvoiceId: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
  }),
  handler: async (ctx, args) => {
    const invoice = await getPendingInvoiceByWorkspace(ctx, args.workspaceId);
    return {
      invoiceId: invoice._id,
      subscriptionId: invoice.subscriptionId,
      providerInvoiceId: invoice.providerInvoiceId,
      workspaceId: invoice.workspaceId,
    };
  },
});

export const getStoredMayarCustomer = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  returns: v.union(v.null(), storedMayarCustomerValidator),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("workspace_billing_customers")
      .withIndex("by_workspace_provider", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("provider", "mayar"),
      )
      .unique();

    if (!row) {
      return null;
    }

    return {
      workspaceId: String(row.workspaceId),
      providerCustomerId: row.providerCustomerId,
      name: row.name,
      email: row.email,
      phone: row.phone,
    };
  },
});

export const upsertStoredMayarCustomer = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    providerCustomerId: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
  },
  returns: storedMayarCustomerValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("workspace_billing_customers")
      .withIndex("by_workspace_provider", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("provider", "mayar"),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        providerCustomerId: args.providerCustomerId,
        name: args.name,
        email: args.email,
        phone: args.phone,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("workspace_billing_customers", {
        workspaceId: args.workspaceId,
        provider: "mayar",
        providerCustomerId: args.providerCustomerId,
        name: args.name,
        email: args.email,
        phone: args.phone,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      workspaceId: String(args.workspaceId),
      providerCustomerId: args.providerCustomerId,
      name: args.name,
      email: args.email,
      phone: args.phone,
    };
  },
});

export const reserveWorkspaceCheckout = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    billingPhone: v.string(),
    createdByUserId: v.id("users"),
  },
  returns: reserveWorkspaceCheckoutResultValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const workspace = ensureActiveWorkspace(await ctx.db.get(args.workspaceId), args.workspaceId);
    const plan = resolveWorkspacePlan(workspace);

    const activeSubscription = await getLatestSubscriptionByStatus(
      ctx,
      args.workspaceId,
      "active",
    );
    if (activeSubscription || plan === "enterprise" || plan === "pro") {
      throw buildBillingError(
        "BILLING_ACTIVE_ENTITLEMENT_EXISTS",
        "Workspace masih memiliki entitlement aktif.",
        { workspaceId: args.workspaceId },
      );
    }

    const openInvoices = await listInvoicesByStatuses(ctx, args.workspaceId, [
      "pending_initializing",
      "pending",
    ]);

    for (const invoice of openInvoices) {
      if (invoice.status === "pending" && typeof invoice.expiresAt === "number" && invoice.expiresAt <= now) {
        await ctx.db.patch(invoice._id, {
          providerStatusText: invoice.providerStatusText ?? "expired",
          status: "expired",
        });
        await ctx.db.patch(invoice.subscriptionId, {
          expiredAt: now,
          status: "expired",
          updatedAt: now,
        });
        continue;
      }

      return {
        workspaceId: String(args.workspaceId),
        reused: true,
        paymentUrl: invoice.paymentUrl,
        invoice: toInvoiceView(invoice),
      };
    }

    const subscriptionId = await ctx.db.insert("workspace_subscriptions", {
      workspaceId: args.workspaceId,
      status: "pending",
      provider: "mayar",
      kind: "pro_one_time",
      startedAt: now,
      activatedAt: undefined,
      currentPeriodStartsAt: undefined,
      currentPeriodEndsAt: undefined,
      expiredAt: undefined,
      canceledAt: undefined,
      createdByUserId: args.createdByUserId,
      updatedAt: now,
    });

    const invoiceId = await ctx.db.insert("workspace_billing_invoices", {
      workspaceId: args.workspaceId,
      subscriptionId,
      provider: "mayar",
      providerInvoiceId: undefined,
      providerTransactionId: undefined,
      status: "pending_initializing",
      amount: WORKSPACE_PRO_PRICE_IDR,
      currency: "IDR",
      paymentUrl: undefined,
      issuedAt: now,
      expiresAt: undefined,
      paidAt: undefined,
      coveredPeriodStartsAt: undefined,
      coveredPeriodEndsAt: undefined,
      lastPolledAt: undefined,
      pollAttempts: 0,
      providerStatusText: undefined,
      rawProviderSnapshot: undefined,
    });

    await emitSubscriptionEvent(ctx, {
      workspaceId: args.workspaceId,
      subscriptionId,
      invoiceId,
      eventType: "checkout_started",
      eventKey: `checkout_started:${String(invoiceId)}`,
      actorUserId: args.createdByUserId,
      payload: { billingPhone: args.billingPhone },
      createdAt: now,
    });

    return {
      workspaceId: String(args.workspaceId),
      subscriptionId: String(subscriptionId),
      invoiceId: String(invoiceId),
      invoiceIssuedAt: now,
      createdByUserId: String(args.createdByUserId),
    };
  },
});

export const finalizeWorkspaceCheckoutSuccess = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    subscriptionId: v.id("workspace_subscriptions"),
    invoiceId: v.id("workspace_billing_invoices"),
    providerInvoiceId: v.string(),
    providerTransactionId: v.optional(v.string()),
    paymentUrl: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    providerStatusText: v.optional(v.string()),
    rawProviderSnapshot: v.optional(v.any()),
  },
  returns: workspaceCheckoutPayloadValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const invoice = await ctx.db.get(args.invoiceId);
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!invoice || !subscription || invoice.workspaceId !== args.workspaceId) {
      throw buildBillingError("BILLING_INVOICE_NOT_FOUND", "Invoice billing tidak ditemukan.", {
        workspaceId: args.workspaceId,
      });
    }

    if (invoice.status === "pending_initializing") {
      await ctx.db.patch(args.invoiceId, {
        expiresAt: args.expiresAt,
        paymentUrl: args.paymentUrl,
        providerInvoiceId: args.providerInvoiceId,
        providerStatusText: args.providerStatusText ?? "unpaid",
        providerTransactionId: args.providerTransactionId,
        rawProviderSnapshot: args.rawProviderSnapshot,
        status: "pending",
      });
      await ctx.db.patch(args.subscriptionId, {
        updatedAt: now,
      });
      await emitSubscriptionEvent(ctx, {
        workspaceId: args.workspaceId,
        subscriptionId: args.subscriptionId,
        invoiceId: args.invoiceId,
        eventType: "invoice_created",
        eventKey: `invoice_created:${args.providerInvoiceId}`,
        actorUserId: subscription.createdByUserId,
        payload: {
          expiresAt: args.expiresAt,
          providerInvoiceId: args.providerInvoiceId,
        },
        createdAt: now,
      });
    }

    const updatedInvoice = await ctx.db.get(args.invoiceId);

    return {
      workspaceId: String(args.workspaceId),
      reused: false,
      paymentUrl: updatedInvoice?.paymentUrl,
      invoice: toInvoiceView(updatedInvoice),
    };
  },
});

export const finalizeWorkspaceCheckoutFailure = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    subscriptionId: v.id("workspace_subscriptions"),
    invoiceId: v.id("workspace_billing_invoices"),
    providerStatusText: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.workspaceId !== args.workspaceId) {
      return null;
    }

    if (invoice.status === "pending_initializing") {
      await ctx.db.patch(args.invoiceId, {
        providerStatusText: args.providerStatusText,
        status: "failed",
      });
    }

    const subscription = await ctx.db.get(args.subscriptionId);
    if (subscription && subscription.status === "pending") {
      await ctx.db.patch(args.subscriptionId, {
        canceledAt: now,
        status: "canceled",
        updatedAt: now,
      });
    }

    await emitSubscriptionEvent(ctx, {
      workspaceId: args.workspaceId,
      subscriptionId: args.subscriptionId,
      invoiceId: args.invoiceId,
      eventType: "invoice_failed",
      eventKey: `invoice_failed:${String(args.invoiceId)}`,
      actorUserId: subscription?.createdByUserId,
      payload: { providerStatusText: args.providerStatusText },
      createdAt: now,
    });

    return null;
  },
});

export const markInvoiceFromProvider = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    subscriptionId: v.id("workspace_subscriptions"),
    invoiceId: v.id("workspace_billing_invoices"),
    providerInvoiceId: v.string(),
    providerTransactionId: v.optional(v.string()),
    providerStatusText: v.string(),
    paymentUrl: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    amount: v.optional(v.number()),
    rawProviderSnapshot: v.optional(v.any()),
  },
  returns: providerInvoiceUpdateResultValidator,
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!invoice || !subscription || invoice.workspaceId !== args.workspaceId) {
      throw buildBillingError("BILLING_INVOICE_NOT_FOUND", "Invoice billing tidak ditemukan.", {
        workspaceId: args.workspaceId,
      });
    }

    const nextStatus = mapMayarInvoiceStatus({
      expiresAt: args.expiresAt,
      providerStatus: args.providerStatusText,
    });
    const nextPollAttempts = (invoice.pollAttempts ?? 0) + 1;
    const patch = {
      amount: typeof args.amount === "number" ? args.amount : invoice.amount,
      expiresAt: args.expiresAt ?? invoice.expiresAt,
      lastPolledAt: Date.now(),
      paidAt: args.paidAt ?? invoice.paidAt,
      paymentUrl: args.paymentUrl ?? invoice.paymentUrl,
      pollAttempts: nextPollAttempts,
      providerInvoiceId: args.providerInvoiceId,
      providerStatusText: args.providerStatusText,
      providerTransactionId: args.providerTransactionId ?? invoice.providerTransactionId,
      rawProviderSnapshot: args.rawProviderSnapshot,
      status: nextStatus,
    };

    await ctx.db.patch(args.invoiceId, patch);

    const updatedSubscriptionPatch = {
      updatedAt: Date.now(),
      ...(nextStatus === "expired"
        ? { expiredAt: args.expiresAt ?? Date.now(), status: "expired" }
        : nextStatus === "canceled" || nextStatus === "failed"
          ? { canceledAt: Date.now(), status: "canceled" }
          : {}),
    };
    await ctx.db.patch(args.subscriptionId, updatedSubscriptionPatch);

    const updatedInvoice = await ctx.db.get(args.invoiceId);
    const updatedSubscription = await ctx.db.get(args.subscriptionId);

    return {
      workspaceId: String(args.workspaceId),
      invoice: toInvoiceView(updatedInvoice),
      subscription: toSubscriptionView(updatedSubscription),
    };
  },
});

export const activatePaidWorkspacePeriod = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    subscriptionId: v.id("workspace_subscriptions"),
    paidAt: v.number(),
  },
  returns: workspaceBillingSummaryValidator,
  handler: async (ctx, args) => {
    const workspace = ensureActiveWorkspace(await ctx.db.get(args.workspaceId), args.workspaceId);
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription || subscription.workspaceId !== args.workspaceId) {
      throw buildBillingError(
        "BILLING_INVOICE_NOT_FOUND",
        "Subscription billing tidak ditemukan.",
        { workspaceId: args.workspaceId },
      );
    }

    if (subscription.status !== "active") {
      const currentPeriodStartsAt = args.paidAt;
      const currentPeriodEndsAt = args.paidAt + WORKSPACE_PRO_PERIOD_MS;
      await ctx.db.patch(args.subscriptionId, {
        activatedAt: subscription.activatedAt ?? args.paidAt,
        currentPeriodStartsAt,
        currentPeriodEndsAt,
        expiredAt: undefined,
        canceledAt: undefined,
        status: "active",
        updatedAt: args.paidAt,
      });

      const invoiceRows = await ctx.db
        .query("workspace_billing_invoices")
        .withIndex("by_workspace_issued_at", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();
      const paidInvoice = invoiceRows.find((row) => row.subscriptionId === args.subscriptionId && row.status === "paid");
      if (paidInvoice) {
        await ctx.db.patch(paidInvoice._id, {
          coveredPeriodStartsAt: currentPeriodStartsAt,
          coveredPeriodEndsAt: currentPeriodEndsAt,
        });
      }

      if (resolveWorkspacePlan(workspace) !== "pro") {
        await ctx.db.patch(args.workspaceId, {
          plan: "pro",
          updatedAt: args.paidAt,
        });
      }

      await emitSubscriptionEvent(ctx, {
        workspaceId: args.workspaceId,
        subscriptionId: args.subscriptionId,
        invoiceId: paidInvoice?._id,
        eventType: "subscription_activated",
        eventKey: `subscription_activated:${String(args.subscriptionId)}`,
        actorUserId: subscription.createdByUserId,
        payload: {
          currentPeriodEndsAt,
          currentPeriodStartsAt,
          paidAt: args.paidAt,
        },
        createdAt: args.paidAt,
      });
    }

    return await buildBillingSummary(ctx, args.workspaceId, "superadmin");
  },
});

export const activateEnterpriseWorkspacePeriod = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    createdByUserId: v.optional(v.id("users")),
    activatedAt: v.number(),
    currentPeriodEndsAt: v.optional(v.number()),
  },
  returns: workspaceBillingSummaryValidator,
  handler: async (ctx, args) => {
    const workspace = ensureActiveWorkspace(await ctx.db.get(args.workspaceId), args.workspaceId);
    const activeSubscription = await getLatestSubscriptionByStatus(ctx, args.workspaceId, "active");

    if (activeSubscription) {
      if (
        activeSubscription.provider === "manual" &&
        activeSubscription.kind === "enterprise_manual"
      ) {
        return await buildBillingSummary(ctx, args.workspaceId, "superadmin");
      }

      throw buildBillingError(
        "BILLING_ACTIVE_ENTITLEMENT_EXISTS",
        "Workspace masih memiliki entitlement aktif.",
        { workspaceId: args.workspaceId },
      );
    }

    const subscriptionId = await ctx.db.insert("workspace_subscriptions", {
      workspaceId: args.workspaceId,
      status: "active",
      provider: "manual",
      kind: "enterprise_manual",
      startedAt: args.activatedAt,
      activatedAt: args.activatedAt,
      currentPeriodStartsAt: args.activatedAt,
      currentPeriodEndsAt: args.currentPeriodEndsAt,
      expiredAt: undefined,
      canceledAt: undefined,
      createdByUserId: args.createdByUserId,
      updatedAt: args.activatedAt,
    });

    if (resolveWorkspacePlan(workspace) !== "enterprise") {
      await ctx.db.patch(args.workspaceId, {
        plan: "enterprise",
        updatedAt: args.activatedAt,
      });
    }

    await emitSubscriptionEvent(ctx, {
      workspaceId: args.workspaceId,
      subscriptionId,
      invoiceId: undefined,
      eventType: "enterprise_activated",
      eventKey: `enterprise_activated:${String(subscriptionId)}`,
      actorUserId: args.createdByUserId,
      payload: {
        activatedAt: args.activatedAt,
        currentPeriodEndsAt: args.currentPeriodEndsAt,
      },
      createdAt: args.activatedAt,
    });

    return await buildBillingSummary(ctx, args.workspaceId, "superadmin");
  },
});

export const cancelEnterpriseWorkspacePeriod = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    canceledAt: v.number(),
  },
  returns: workspaceBillingSummaryValidator,
  handler: async (ctx, args) => {
    const workspace = ensureActiveWorkspace(await ctx.db.get(args.workspaceId), args.workspaceId);
    const activeSubscription = await getLatestSubscriptionByStatus(ctx, args.workspaceId, "active");

    if (
      !activeSubscription ||
      activeSubscription.provider !== "manual" ||
      activeSubscription.kind !== "enterprise_manual"
    ) {
      return await buildBillingSummary(ctx, args.workspaceId, "superadmin");
    }

    await ctx.db.patch(activeSubscription._id, {
      canceledAt: args.canceledAt,
      status: "canceled",
      updatedAt: args.canceledAt,
    });

    if (resolveWorkspacePlan(workspace) !== "free") {
      await ctx.db.patch(args.workspaceId, {
        plan: "free",
        updatedAt: args.canceledAt,
      });
    }

    await emitSubscriptionEvent(ctx, {
      workspaceId: args.workspaceId,
      subscriptionId: activeSubscription._id,
      invoiceId: undefined,
      eventType: "enterprise_canceled",
      eventKey: `enterprise_canceled:${String(activeSubscription._id)}`,
      actorUserId: activeSubscription.createdByUserId,
      payload: { canceledAt: args.canceledAt },
      createdAt: args.canceledAt,
    });

    return await buildBillingSummary(ctx, args.workspaceId, "superadmin");
  },
});

export const listPendingInvoicesForReconciliation = internalQuery({
  args: {},
  returns: v.array(pendingInvoiceReconciliationRowValidator),
  handler: async (ctx) => {
    const rows = await listInvoicesByStatuses(ctx, undefined, ["pending_initializing", "pending"]);
    const now = Date.now();

    return rows
      .filter((row) => {
        if (row.status === "pending") {
          return typeof row.providerInvoiceId === "string" && row.providerInvoiceId.length > 0;
        }

        return row.issuedAt + 10 * 60 * 1000 <= now;
      })
      .map((row) => ({
        invoiceId: row._id,
        subscriptionId: row.subscriptionId,
        providerInvoiceId: row.providerInvoiceId,
        workspaceId: row.workspaceId,
      }));
  },
});

export const listExpiredActiveWorkspacePeriods = internalQuery({
  args: {},
  returns: v.array(expiredActiveWorkspacePeriodRowValidator),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("workspace_subscriptions")
      .withIndex("by_status_period_end", (q) => q.eq("status", "active"))
      .collect();
    const now = Date.now();

    return rows
      .filter(
        (row) => typeof row.currentPeriodEndsAt === "number" && row.currentPeriodEndsAt <= now,
      )
      .sort((left, right) => left.currentPeriodEndsAt - right.currentPeriodEndsAt)
      .map((row) => ({
        currentPeriodEndsAt: row.currentPeriodEndsAt,
        subscriptionId: row._id,
        workspaceId: row.workspaceId,
      }));
  },
});

export const reconcilePendingWorkspaceInvoices = internalAction({
  args: {},
  returns: reconcilePendingWorkspaceInvoicesResultValidator,
  handler: async (ctx) => {
    const pendingInvoices = await ctx.runQuery(
      internal.workspaceBilling.listPendingInvoicesForReconciliation,
      {},
    );
    let paidCount = 0;
    let expiredCount = 0;

    for (const pendingInvoice of pendingInvoices) {
      if (!pendingInvoice.providerInvoiceId) {
        continue;
      }

      try {
        const providerStatus = await ctx.runAction(
          internal.workspaceBillingMayar.fetchMayarInvoiceStatus,
          {
            providerInvoiceId: pendingInvoice.providerInvoiceId,
          },
        );
        const invoiceUpdate = await ctx.runMutation(
          internal.workspaceBilling.markInvoiceFromProvider,
          {
            amount: providerStatus.amount,
            expiresAt: providerStatus.expiresAt,
            invoiceId: pendingInvoice.invoiceId,
            paidAt: providerStatus.paidAt,
            paymentUrl: providerStatus.paymentUrl,
            providerInvoiceId: providerStatus.providerInvoiceId,
            providerStatusText: providerStatus.providerStatusText,
            providerTransactionId: providerStatus.providerTransactionId,
            rawProviderSnapshot: providerStatus.rawProviderSnapshot,
            subscriptionId: pendingInvoice.subscriptionId,
            workspaceId: pendingInvoice.workspaceId,
          },
        );

        if (invoiceUpdate.invoice.status === "paid") {
          paidCount += 1;
          await ctx.runMutation(internal.workspaceBilling.activatePaidWorkspacePeriod, {
            paidAt: invoiceUpdate.invoice.paidAt ?? Date.now(),
            subscriptionId: pendingInvoice.subscriptionId,
            workspaceId: pendingInvoice.workspaceId,
          });
        }

        if (invoiceUpdate.invoice.status === "expired") {
          expiredCount += 1;
        }
      } catch (error) {
        console.error("[workspaceBilling:reconcilePendingWorkspaceInvoices] failed", {
          invoiceId: String(pendingInvoice.invoiceId),
          workspaceId: String(pendingInvoice.workspaceId),
          error: String(error),
        });
      }
    }

    return {
      expiredCount,
      paidCount,
      processedCount: pendingInvoices.length,
    };
  },
});

export const expireActiveWorkspacePeriods = internalAction({
  args: {},
  returns: expireActiveWorkspacePeriodsResultValidator,
  handler: async (ctx) => {
    const expiredPeriods = await ctx.runQuery(
      internal.workspaceBilling.listExpiredActiveWorkspacePeriods,
      {},
    );

    for (const period of expiredPeriods) {
      try {
        await ctx.runMutation(internal.workspaceBilling.expireWorkspacePeriod, {
          expiredAt: period.currentPeriodEndsAt,
          subscriptionId: period.subscriptionId,
          workspaceId: period.workspaceId,
        });
      } catch (error) {
        console.error("[workspaceBilling:expireActiveWorkspacePeriods] failed", {
          subscriptionId: String(period.subscriptionId),
          workspaceId: String(period.workspaceId),
          error: String(error),
        });
      }
    }

    return { processedCount: expiredPeriods.length };
  },
});

export const expireWorkspacePeriod = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    subscriptionId: v.id("workspace_subscriptions"),
    expiredAt: v.number(),
  },
  returns: workspaceBillingSummaryValidator,
  handler: async (ctx, args) => {
    const workspace = ensureActiveWorkspace(await ctx.db.get(args.workspaceId), args.workspaceId);
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription || subscription.workspaceId !== args.workspaceId) {
      throw buildBillingError(
        "BILLING_INVOICE_NOT_FOUND",
        "Subscription billing tidak ditemukan.",
        { workspaceId: args.workspaceId },
      );
    }

    if (subscription.status !== "expired") {
      await ctx.db.patch(args.subscriptionId, {
        expiredAt: args.expiredAt,
        status: "expired",
        updatedAt: args.expiredAt,
      });

      if (resolveWorkspacePlan(workspace) !== "free") {
        await ctx.db.patch(args.workspaceId, {
          plan: "free",
          updatedAt: args.expiredAt,
        });
      }

      await emitSubscriptionEvent(ctx, {
        workspaceId: args.workspaceId,
        subscriptionId: args.subscriptionId,
        invoiceId: undefined,
        eventType: "subscription_expired",
        eventKey: `subscription_expired:${String(args.subscriptionId)}`,
        actorUserId: subscription.createdByUserId,
        payload: { expiredAt: args.expiredAt },
        createdAt: args.expiredAt,
      });
    }

    return await buildBillingSummary(ctx, args.workspaceId, "superadmin");
  },
});
