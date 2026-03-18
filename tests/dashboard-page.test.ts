import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('dashboard page', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders the Tally popup and overview for admin roles', async () => {
    const requireWorkspaceRolePageFromDb = vi.fn(async () => ({ role: 'admin' }));

    vi.doMock('@/lib/auth', () => ({
      requireWorkspaceRolePageFromDb,
    }));
    vi.doMock('@/components/dashboard/page-header', () => ({
      DashboardPageHeader: ({ title }: { title: string }) =>
        React.createElement('div', { 'data-testid': 'header' }, title),
    }));
    vi.doMock('@/components/dashboard/overview-panel', () => ({
      OverviewPanel: () => React.createElement('div', { 'data-testid': 'overview-panel' }),
    }));
    vi.doMock('@/components/dashboard/employee-overview-panel', () => ({
      EmployeeOverviewPanel: () =>
        React.createElement('div', { 'data-testid': 'employee-overview-panel' }),
    }));

    const pageModule = await import('../app/dashboard/page');
    const element = await pageModule.default();
    const html = renderToStaticMarkup(element);

    expect(requireWorkspaceRolePageFromDb).toHaveBeenCalledWith([
      'admin',
      'superadmin',
      'karyawan',
    ]);
    expect(html).toContain('Ringkasan Operasional');
    expect(html).toContain('data-testid="overview-panel"');
  });

  it('renders the employee overview copy for karyawan', async () => {
    const requireWorkspaceRolePageFromDb = vi.fn(async () => ({ role: 'karyawan' }));

    vi.doMock('@/lib/auth', () => ({
      requireWorkspaceRolePageFromDb,
    }));
    vi.doMock('@/components/dashboard/page-header', () => ({
      DashboardPageHeader: ({
        title,
        description,
      }: {
        title: string;
        description?: string;
      }) =>
        React.createElement(
          'div',
          {
            'data-testid': 'header',
            'data-description': description,
          },
          title,
        ),
    }));
    vi.doMock('@/components/dashboard/overview-panel', () => ({
      OverviewPanel: () => React.createElement('div', { 'data-testid': 'overview-panel' }),
    }));
    vi.doMock('@/components/dashboard/employee-overview-panel', () => ({
      EmployeeOverviewPanel: () =>
        React.createElement('div', { 'data-testid': 'employee-overview-panel' }),
    }));

    const pageModule = await import('../app/dashboard/page');
    const element = await pageModule.default();
    const html = renderToStaticMarkup(element);

    expect(requireWorkspaceRolePageFromDb).toHaveBeenCalledWith([
      'admin',
      'superadmin',
      'karyawan',
    ]);
    expect(html).toContain('Ringkasan Kehadiran Saya');
    expect(html).toContain(
      'data-description="Pantau disiplin check-in, tren personal, dan progress mingguan."',
    );
    expect(html).toContain('data-testid="employee-overview-panel"');
  });
});
