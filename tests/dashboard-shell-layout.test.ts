import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

describe('dashboard shell layout', () => {
  it('renders the shared Tally trigger and widget script for dashboard-like areas', async () => {
    vi.doMock('@/components/providers/sidebar-provider', () => ({
      SidebarProvider: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
    }));
    vi.doMock('@/components/dashboard/workspace-hub-provider', () => ({
      WorkspaceHubProvider: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
    }));
    vi.doMock('@/components/dashboard/header', () => ({
      DashboardHeader: () => React.createElement('div', { 'data-testid': 'dashboard-header' }),
    }));
    vi.doMock('@/components/dashboard/sidebar', () => ({
      DashboardSidebar: () => React.createElement('div', { 'data-testid': 'dashboard-sidebar' }),
    }));
    vi.doMock('@/components/dashboard/mobile-bottom-nav', () => ({
      MobileBottomNav: () =>
        React.createElement('div', { 'data-testid': 'mobile-bottom-nav' }),
    }));
    vi.doMock('@/components/dashboard/tally-popup-trigger', () => ({
      TallyPopupTrigger: () =>
        React.createElement('button', { 'data-testid': 'tally-popup-trigger' }),
    }));
    vi.doMock('@/components/dashboard/workspace-restricted-gate', () => ({
      WorkspaceRestrictedGate: () =>
        React.createElement('div', { 'data-testid': 'workspace-restricted-gate' }),
    }));
    vi.doMock('next/script', () => ({
      default: ({
        id,
        src,
      }: {
        id?: string;
        src?: string;
      }) => React.createElement('script', { id, src }),
    }));

    const layoutModule = await import('../components/dashboard/layout');
    const html = renderToStaticMarkup(
      React.createElement(
        layoutModule.DashboardLayout,
        {
          role: 'admin',
          name: 'Admin User',
          email: 'admin@example.com',
        },
        React.createElement('div', { 'data-testid': 'page-content' }),
      ),
    );

    expect(html).toContain('data-testid="dashboard-header"');
    expect(html).toContain('data-testid="dashboard-sidebar"');
    expect(html).toContain('data-testid="mobile-bottom-nav"');
    expect(html).toContain('data-testid="page-content"');
    expect(html).toContain('data-testid="tally-popup-trigger"');
    expect(html).toContain('data-testid="workspace-restricted-gate"');
    expect(html).toContain('id="tally-widget"');
    expect(html).toContain('src="https://tally.so/widgets/embed.js"');
  });
});
