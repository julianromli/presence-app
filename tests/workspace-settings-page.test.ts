import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('workspace settings page', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders the billing-enabled workspace management panel for superadmin', async () => {
    const requireWorkspaceRolePageFromDb = vi.fn(async () => ({ role: 'superadmin' }));

    vi.doMock('@/lib/auth', () => ({
      requireWorkspaceRolePageFromDb,
    }));
    vi.doMock('@/components/dashboard/page-header', () => ({
      DashboardPageHeader: ({ title }: { title: string }) =>
        React.createElement('div', { 'data-testid': 'workspace-header' }, title),
    }));
    vi.doMock('@/components/dashboard/workspace-panel', () => ({
      WorkspacePanel: () => React.createElement('div', { 'data-testid': 'workspace-panel' }),
    }));

    const pageModule = await import('../app/settings/workspace/page');
    const element = await pageModule.default();
    const html = renderToStaticMarkup(element);

    expect(requireWorkspaceRolePageFromDb).toHaveBeenCalledWith(['superadmin']);
    expect(html).toContain('Workspace Management');
    expect(html).toContain('data-testid="workspace-panel"');
  });
});
