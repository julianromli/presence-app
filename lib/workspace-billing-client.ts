import {
  normalizeClientError,
  parseApiErrorResponse,
} from "@/lib/client-error";
import { workspaceFetch } from "@/lib/workspace-client";
import type {
  WorkspaceBillingInvoiceDetailPayload,
  WorkspaceBillingInvoicesPayload,
  WorkspaceBillingSummaryPayload,
  WorkspaceCheckoutPayload,
  WorkspaceRestrictedExpiredStatePayload,
} from "@/types/dashboard";

export async function fetchWorkspaceBillingSummary() {
  const response = await workspaceFetch("/api/workspaces/current/billing", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw await parseApiErrorResponse(
      response,
      "Gagal memuat billing workspace.",
    );
  }

  return (await response.json()) as WorkspaceBillingSummaryPayload;
}

export async function fetchWorkspaceBillingInvoices() {
  const response = await workspaceFetch(
    "/api/workspaces/current/billing/invoices",
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw await parseApiErrorResponse(
      response,
      "Gagal memuat riwayat pembayaran workspace.",
    );
  }

  return (await response.json()) as WorkspaceBillingInvoicesPayload;
}

export async function fetchWorkspaceBillingInvoiceDetail(invoiceId: string) {
  const response = await workspaceFetch(
    `/api/workspaces/current/billing/invoices/${encodeURIComponent(invoiceId)}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw await parseApiErrorResponse(
      response,
      "Gagal memuat detail invoice workspace.",
    );
  }

  return (await response.json()) as WorkspaceBillingInvoiceDetailPayload;
}

export async function createWorkspaceCheckout(billingPhone: string) {
  const response = await workspaceFetch(
    "/api/workspaces/current/billing/checkout",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ billingPhone }),
    },
  );

  if (!response.ok) {
    throw await parseApiErrorResponse(
      response,
      "Gagal membuat checkout workspace.",
    );
  }

  return (await response.json()) as WorkspaceCheckoutPayload;
}

export async function refreshWorkspacePendingInvoice() {
  const response = await workspaceFetch(
    "/api/workspaces/current/billing/refresh",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    },
  );

  if (!response.ok) {
    throw await parseApiErrorResponse(
      response,
      "Gagal menyegarkan status pembayaran workspace.",
    );
  }

  return (await response.json()) as WorkspaceBillingSummaryPayload;
}

export async function cancelWorkspacePendingInvoice() {
  const response = await workspaceFetch(
    "/api/workspaces/current/billing/cancel",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    },
  );

  if (!response.ok) {
    throw await parseApiErrorResponse(
      response,
      "Gagal membatalkan invoice pending workspace.",
    );
  }

  return (await response.json()) as WorkspaceBillingSummaryPayload;
}

export async function fetchWorkspaceRestrictions() {
  const response = await workspaceFetch(
    "/api/workspaces/current/restrictions",
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw await parseApiErrorResponse(
      response,
      "Gagal memuat status pembatasan workspace.",
    );
  }

  return (await response.json()) as WorkspaceRestrictedExpiredStatePayload;
}

export async function normalizeWorkspaceBillingError(
  error: unknown,
  fallbackMessage: string,
) {
  return await normalizeClientError(error, fallbackMessage);
}
