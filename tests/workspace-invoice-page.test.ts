import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('workspace invoice page', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('loads invoice detail for the active workspace and renders the invoice document', async () => {
    const requireWorkspaceRolePageFromDb = vi.fn(async () => ({
      role: 'superadmin',
      workspace: { _id: 'workspace_123456' },
    }));
    const query = vi.fn(async () => ({
      customer: {
        email: 'owner@absenin.id',
        name: 'Owner Workspace',
        phone: '+6281234567890',
        providerCustomerId: 'mayar_customer_123',
        workspaceId: 'workspace_123456',
      },
      invoice: {
        amount: 150000,
        currency: 'IDR',
        invoiceId: 'invoice_paid_123',
        issuedAt: 1_900_000_000_000,
        paidAt: 1_900_000_100_000,
        pollAttempts: 1,
        provider: 'mayar',
        providerInvoiceId: 'mayar_invoice_paid_123',
        providerTransactionId: 'mayar_txn_paid_123',
        status: 'paid',
      },
      subscription: null,
      workspace: {
        id: 'workspace_123456',
        name: 'Workspace Demo',
        plan: 'pro',
        timezone: 'Asia/Jakarta',
      },
    }));

    vi.doMock('@/lib/auth', () => ({
      getConvexTokenOrNull: vi.fn(async () => 'convex-token'),
      requireWorkspaceRolePageFromDb,
    }));
    vi.doMock('@/lib/convex-http', () => ({
      getAuthedConvexHttpClient: vi.fn(() => ({ query })),
    }));
    vi.doMock('@/components/dashboard/workspace-invoice-document', () => ({
      WorkspaceInvoiceDocument: ({
        detail,
        intent,
      }: {
        detail: { workspace: { name: string } };
        intent?: string;
      }) =>
        React.createElement(
          'div',
          {
            'data-testid': 'workspace-invoice-document',
            'data-intent': intent,
            'data-workspace': detail.workspace.name,
          },
          'invoice-document',
        ),
    }));
    vi.doMock('@/components/dashboard/workspace-invoice-print-toolbar', () => ({
      WorkspaceInvoicePrintToolbar: ({ intent }: { intent?: string }) =>
        React.createElement('div', { 'data-testid': 'workspace-invoice-toolbar', 'data-intent': intent }),
    }));

    const pageModule = await import('../app/(print)/settings/workspace/invoices/[invoiceId]/page');
    const element = await pageModule.default({
      params: Promise.resolve({ invoiceId: 'invoice_paid_123' }),
      searchParams: Promise.resolve({ intent: 'download' }),
    });
    const html = renderToStaticMarkup(element);

    expect(requireWorkspaceRolePageFromDb).toHaveBeenCalledWith(['superadmin']);
    expect(query).toHaveBeenCalledWith(
      'workspaceBilling:getWorkspaceBillingInvoiceDetail',
      {
        invoiceId: 'invoice_paid_123',
        workspaceId: 'workspace_123456',
      },
    );
    expect(html).toContain('data-testid="workspace-invoice-document"');
    expect(html).toContain('data-intent="download"');
    expect(html).toContain('data-workspace="Workspace Demo"');
    expect(html).toContain('data-testid="workspace-invoice-toolbar"');
  }, 15000);

  it('maps missing invoices into notFound handling', async () => {
    const requireWorkspaceRolePageFromDb = vi.fn(async () => ({
      role: 'superadmin',
      workspace: { _id: 'workspace_123456' },
    }));
    const query = vi.fn(async () => {
      throw { data: { code: 'BILLING_INVOICE_NOT_FOUND' } };
    });
    const notFound = vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND');
    });

    vi.doMock('@/lib/auth', () => ({
      getConvexTokenOrNull: vi.fn(async () => 'convex-token'),
      requireWorkspaceRolePageFromDb,
    }));
    vi.doMock('@/lib/convex-http', () => ({
      getAuthedConvexHttpClient: vi.fn(() => ({ query })),
    }));
    vi.doMock('next/navigation', async () => {
      const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
      return {
        ...actual,
        notFound,
      };
    });

    const pageModule = await import('../app/(print)/settings/workspace/invoices/[invoiceId]/page');

    await expect(
      pageModule.default({
        params: Promise.resolve({ invoiceId: 'invoice_missing' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
