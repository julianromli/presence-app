import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import WorkspaceInvoiceNotFoundPage from '../app/(print)/settings/workspace/invoices/[invoiceId]/not-found';

describe('workspace invoice not-found page', () => {
  it('renders a dedicated missing invoice state with recovery actions', () => {
    const html = renderToStaticMarkup(React.createElement(WorkspaceInvoiceNotFoundPage));

    expect(html).toContain('Invoice tidak ditemukan');
    expect(html).toContain('Kembali ke Billing Workspace');
    expect(html).toContain('Kembali ke Dashboard');
  });
});
