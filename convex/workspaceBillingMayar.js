import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { SITE_URL } from "../lib/site-config";

const mayarCustomerResultValidator = v.object({
  workspaceId: v.string(),
  providerCustomerId: v.string(),
  name: v.string(),
  email: v.string(),
  phone: v.string(),
});

const mayarInvoiceResultValidator = v.object({
  providerInvoiceId: v.string(),
  providerTransactionId: v.optional(v.string()),
  paymentUrl: v.string(),
  expiresAt: v.optional(v.number()),
  providerStatusText: v.string(),
  rawProviderSnapshot: v.any(),
});

const mayarInvoiceStatusResultValidator = v.object({
  amount: v.optional(v.number()),
  expiresAt: v.optional(v.number()),
  paidAt: v.optional(v.number()),
  paymentUrl: v.optional(v.string()),
  providerInvoiceId: v.string(),
  providerStatusText: v.string(),
  providerTransactionId: v.optional(v.string()),
  rawProviderSnapshot: v.any(),
});

function requireMayarApiKey() {
  const apiKey = process.env.MAYAR_API_KEY?.trim();
  if (!apiKey) {
    throw new ConvexError({
      code: "BILLING_SYNC_FAILED",
      message: "Konfigurasi Mayar belum lengkap.",
    });
  }

  return apiKey;
}

function getMayarBaseUrl() {
  const configured = process.env.MAYAR_API_BASE_URL?.trim();
  return (configured && configured.length > 0 ? configured : "https://api.mayar.id").replace(/\/$/, "");
}

function getMayarRedirectUrl() {
  const configured = process.env.MAYAR_REDIRECT_URL?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }

  return `${SITE_URL}/settings/workspace`;
}

function toMayarErrorMessage(payload, fallbackMessage) {
  if (payload && typeof payload === "object") {
    const message = payload.messages;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

async function fetchMayar(path, options = {}) {
  const apiKey = requireMayarApiKey();
  const response = await fetch(`${getMayarBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ConvexError({
      code: "BILLING_SYNC_FAILED",
      message: toMayarErrorMessage(payload, "Gagal terhubung ke Mayar."),
      status: response.status,
    });
  }

  if (!payload || typeof payload !== "object" || payload.data === undefined) {
    throw new ConvexError({
      code: "BILLING_SYNC_FAILED",
      message: "Respons Mayar tidak valid.",
    });
  }

  return payload.data;
}

export const createMayarCustomerIfNeeded = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    email: v.string(),
    billingPhone: v.string(),
  },
  returns: mayarCustomerResultValidator,
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery(internal.workspaceBilling.getStoredMayarCustomer, {
      workspaceId: args.workspaceId,
    });

    if (existing?.providerCustomerId) {
      return await ctx.runMutation(internal.workspaceBilling.upsertStoredMayarCustomer, {
        workspaceId: args.workspaceId,
        providerCustomerId: existing.providerCustomerId,
        name: args.name,
        email: args.email,
        phone: args.billingPhone,
      });
    }

    const data = await fetchMayar("/hl/v1/customer/create", {
      method: "POST",
      body: {
        name: args.name,
        email: args.email,
        mobile: args.billingPhone,
      },
    });

    const providerCustomerId =
      (typeof data.customerId === "string" && data.customerId) ||
      (typeof data.response === "string" && data.response) ||
      (typeof data.id === "string" && data.id);

    if (!providerCustomerId) {
      throw new ConvexError({
        code: "BILLING_SYNC_FAILED",
        message: "Mayar tidak mengembalikan customerId.",
      });
    }

    return await ctx.runMutation(internal.workspaceBilling.upsertStoredMayarCustomer, {
      workspaceId: args.workspaceId,
      providerCustomerId,
      name: args.name,
      email: args.email,
      phone: args.billingPhone,
    });
  },
});

export const createMayarInvoice = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    subscriptionId: v.string(),
    invoiceId: v.string(),
    providerCustomerId: v.optional(v.string()),
    customerName: v.string(),
    customerEmail: v.string(),
    billingPhone: v.string(),
    amount: v.number(),
  },
  returns: mayarInvoiceResultValidator,
  handler: async (_ctx, args) => {
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const data = await fetchMayar("/hl/v1/invoice/create", {
      method: "POST",
      body: {
        name: args.customerName,
        email: args.customerEmail,
        mobile: args.billingPhone,
        redirectUrl: getMayarRedirectUrl(),
        description: "Absenin.id Workspace Pro 30 hari",
        expiredAt: new Date(expiresAt).toISOString(),
        items: [
          {
            quantity: 1,
            rate: args.amount,
            description: "Workspace Pro 30 hari",
          },
        ],
        extraData: {
          workspaceId: String(args.workspaceId),
          subscriptionId: args.subscriptionId,
          invoiceId: args.invoiceId,
          providerCustomerId: args.providerCustomerId,
        },
      },
    });

    const paymentUrl =
      (typeof data.link === "string" && data.link) ||
      (typeof data.paymentUrl === "string" && data.paymentUrl);
    if (!paymentUrl || typeof data.id !== "string") {
      throw new ConvexError({
        code: "BILLING_SYNC_FAILED",
        message: "Mayar tidak mengembalikan invoice yang valid.",
      });
    }

    return {
      providerInvoiceId: data.id,
      providerTransactionId:
        typeof data.transactionId === "string" ? data.transactionId : undefined,
      paymentUrl,
      expiresAt: typeof data.expiredAt === "number" ? data.expiredAt : expiresAt,
      providerStatusText: "unpaid",
      rawProviderSnapshot: data,
    };
  },
});

export const fetchMayarInvoiceStatus = internalAction({
  args: {
    providerInvoiceId: v.string(),
  },
  returns: mayarInvoiceStatusResultValidator,
  handler: async (_ctx, args) => {
    const data = await fetchMayar(`/hl/v1/invoice/${args.providerInvoiceId}`);
    return {
      amount: typeof data.amount === "number" ? data.amount : undefined,
      expiresAt: typeof data.expiredAt === "number" ? data.expiredAt : undefined,
      paidAt: typeof data.paidAt === "number" ? data.paidAt : undefined,
      paymentUrl:
        typeof data.paymentUrl === "string"
          ? data.paymentUrl
          : typeof data.link === "string"
            ? data.link
            : undefined,
      providerInvoiceId: args.providerInvoiceId,
      providerStatusText:
        typeof data.status === "string" && data.status.trim().length > 0
          ? data.status
          : "unknown",
      providerTransactionId:
        typeof data.transactionId === "string"
          ? data.transactionId
          : Array.isArray(data.transactions) && typeof data.transactions[0]?.id === "string"
            ? data.transactions[0].id
            : undefined,
      rawProviderSnapshot: data,
    };
  },
});
