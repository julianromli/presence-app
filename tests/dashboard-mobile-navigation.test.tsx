import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function createLinkComponent() {
  const MockLink = ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => React.createElement('a', { href, ...props }, children);

  MockLink.displayName = 'MockLink';
  return MockLink;
}

describe('dashboard mobile navigation', () => {
  let workspaceHubState: {
    memberships: Array<{
      workspace: {
        _id: string;
        name: string;
        slug: string;
      };
      role: 'superadmin' | 'admin' | 'karyawan' | 'device-qr';
    }>;
    activeWorkspaceId: string | null;
    activeWorkspaceName: string;
    loading: boolean;
    pendingAction: 'none' | 'switch' | 'create' | 'join';
    notice: null;
  };

  beforeEach(() => {
    vi.resetModules();
    workspaceHubState = {
      memberships: [
        {
          workspace: {
            _id: 'workspace_123456',
            name: 'Lumbung Tour Haramain',
            slug: 'lumbung-tour-haramain',
          },
          role: 'admin',
        },
      ],
      activeWorkspaceId: 'workspace_123456',
      activeWorkspaceName: 'Lumbung Tour Haramain',
      loading: false,
      pendingAction: 'none',
      notice: null,
    };

    vi.doMock('next/link', () => ({
      default: createLinkComponent(),
    }));
    vi.doMock('@/components/dashboard/navigation-config', async () =>
      import('../components/dashboard/navigation-config')
    );
    vi.doMock('@/lib/utils', () => ({
      cn: (...values: Array<string | false | null | undefined>) =>
        values.filter(Boolean).join(' '),
    }));
    vi.doMock('next/navigation', () => ({
      usePathname: () => '/dashboard/report',
      useRouter: () => ({
        push: vi.fn(),
        refresh: vi.fn(),
      }),
      useSearchParams: () => new URLSearchParams('q=faiz'),
    }));
    vi.doMock('framer-motion', () => ({
      motion: {
        div: ({
          children,
          ...props
        }: {
          children?: React.ReactNode;
          [key: string]: unknown;
        }) => {
          const nextProps = { ...props };
          delete nextProps.initial;
          delete nextProps.layoutId;
          return React.createElement('div', nextProps, children);
        },
      },
    }));
    vi.doMock('@clerk/nextjs', () => ({
      SignOutButton: ({ children }: { children: React.ReactNode }) => children,
      UserButton: (props: Record<string, unknown>) => {
        const nextProps = { ...props };
        delete nextProps.afterSignOutUrl;
        return React.createElement('div', { 'data-testid': 'user-button', ...nextProps });
      },
      useUser: () => ({ user: null }),
    }));
    vi.doMock('@/components/ui/button', () => ({
      Button: ({
        children,
        ...props
      }: {
        children?: React.ReactNode;
        [key: string]: unknown;
      }) => {
        const nextProps = { ...props };
        delete nextProps.isLoading;
        return React.createElement('button', nextProps, children);
      },
    }));
    vi.doMock('@/components/ui/sheet', () => ({
      Sheet: ({
        open,
        children,
      }: {
        open?: boolean;
        children: React.ReactNode;
      }) => (open ? React.createElement('div', { 'data-open': String(open) }, children) : null),
      SheetPopup: ({
        children,
        ...props
      }: {
        children: React.ReactNode;
        [key: string]: unknown;
      }) => {
        const nextProps = { ...props };
        delete nextProps.showCloseButton;
        return React.createElement('section', nextProps, children);
      },
      SheetHeader: ({
        children,
        ...props
      }: {
        children: React.ReactNode;
        [key: string]: unknown;
      }) => React.createElement('header', props, children),
      SheetPanel: ({
        children,
        ...props
      }: {
        children: React.ReactNode;
        [key: string]: unknown;
      }) => React.createElement('div', props, children),
      SheetTitle: ({
        children,
        ...props
      }: {
        children: React.ReactNode;
        [key: string]: unknown;
      }) => React.createElement('h2', props, children),
      SheetDescription: ({
        children,
        ...props
      }: {
        children: React.ReactNode;
        [key: string]: unknown;
      }) => React.createElement('p', props, children),
    }));
    vi.doMock('@/components/ui/menu', () => ({
      Menu: ({ children }: { children: React.ReactNode }) => children,
      MenuItem: ({ children }: { children: React.ReactNode }) => children,
      MenuPopup: ({ children }: { children: React.ReactNode }) => children,
      MenuRadioGroup: ({ children }: { children: React.ReactNode }) => children,
      MenuRadioItem: ({ children }: { children: React.ReactNode }) => children,
      MenuSeparator: () => React.createElement('hr'),
      MenuTrigger: ({
        children,
        ...props
      }: {
        children: React.ReactNode;
        [key: string]: unknown;
      }) => React.createElement('button', props, children),
    }));
    vi.doMock('@/components/providers/sidebar-provider', () => ({
      useSidebar: () => ({
        isCollapsed: false,
        toggleSidebar: vi.fn(),
      }),
    }));
    vi.doMock('@/components/dashboard/workspace-hub-provider', () => ({
      useWorkspaceHub: () => ({
        ...workspaceHubState,
        clearNotice: vi.fn(),
        refreshMemberships: vi.fn(),
        switchWorkspace: vi.fn(async () => true),
        createWorkspace: vi.fn(async () => true),
        joinWorkspace: vi.fn(async () => true),
      }),
      WorkspaceHubProvider: ({ children }: { children: React.ReactNode }) => children,
    }));
  });

  it('renders karyawan More content with Clerk account access and no duplicate logout', async () => {
    const { DashboardMobileMoreSheet } = await import(
      '../components/dashboard/mobile-bottom-nav'
    );
    const html = renderToStaticMarkup(
      <DashboardMobileMoreSheet
        role="karyawan"
        name="Budi"
        email="budi@example.com"
        pathname="/dashboard"
        activeQuery="faiz"
        open
        onOpenChange={() => undefined}
      />,
    );

    expect(html).toContain('Akun');
    expect(html).toContain('Kelola akun');
    expect(html).toContain('data-testid="user-button"');
    expect(html).not.toContain('Bantuan');
    expect(html).not.toContain('/dashboard/help?q=faiz');
    expect(html).not.toContain('Keluar');
    expect(html).not.toContain('Geofence');
  }, 60000);

  it('renders superadmin More content with device, workspace, and geofence links', async () => {
    const { DashboardMobileMoreSheet } = await import(
      '../components/dashboard/mobile-bottom-nav'
    );
    const html = renderToStaticMarkup(
      <DashboardMobileMoreSheet
        role="superadmin"
        name="Sari"
        email="sari@example.com"
        pathname="/settings/workspace"
        activeQuery=""
        open
        onOpenChange={() => undefined}
      />,
    );

    expect(html).toContain('Device QR');
    expect(html).toContain('/dashboard/device-qr');
    expect(html).toContain('Workspace');
    expect(html).toContain('Geofence');
    expect(html).toContain('/settings/workspace');
    expect(html).toContain('/settings/geofence');
  });

  it('renders the dock with More and without a dedicated Akun tab', async () => {
    const { MobileBottomNav } = await import('../components/dashboard/mobile-bottom-nav');
    const html = renderToStaticMarkup(
      <MobileBottomNav role="admin" name="Faiz" email="faiz@example.com" />,
    );

    expect(html).toContain('Ringkasan');
    expect(html).toContain('Laporan');
    expect(html).toContain('Karyawan');
    expect(html).toContain('More');
    expect(html).not.toContain('>Akun<');
  });

  it('hides the dashboard header UserButton on mobile', async () => {
    vi.doMock('@/lib/workspace-client', () => ({
      recoverWorkspaceScopeViolation: vi.fn(() => false),
      setActiveWorkspaceIdInBrowser: vi.fn(),
      workspaceFetch: vi.fn(async () => ({
        ok: false,
      })),
    }));
    vi.doMock('@/lib/client-error', () => ({
      parseApiErrorResponse: vi.fn(async () => ({
        code: 'ERR',
        message: 'error',
      })),
    }));

    const { DashboardHeader } = await import('../components/dashboard/header');
    const html = renderToStaticMarkup(
      <DashboardHeader role="admin" name="Faiz" email="faiz@example.com" />,
    );

    expect(html).toContain('hidden md:block');
    expect(html).toContain('data-testid="user-button"');
  });

  it('renders create and join workspace actions inside the desktop workspace menu', async () => {
    vi.doMock('@/lib/workspace-client', () => ({
      recoverWorkspaceScopeViolation: vi.fn(() => false),
      setActiveWorkspaceIdInBrowser: vi.fn(),
      workspaceFetch: vi.fn(async () => ({
        ok: false,
      })),
    }));
    vi.doMock('@/lib/client-error', () => ({
      parseApiErrorResponse: vi.fn(async () => ({
        code: 'ERR',
        message: 'error',
      })),
    }));

    const { DashboardHeader } = await import('../components/dashboard/header');
    const html = renderToStaticMarkup(
      <DashboardHeader role="admin" name="Faiz" email="faiz@example.com" />,
    );

    expect(html).toContain('Buat workspace baru');
    expect(html).toContain('Gabung workspace');
    expect(html).toContain('Lumbung Tour Haramain');
    expect(html).toContain('hidden items-center gap-2 text-sm text-zinc-300 md:flex');
  });

  it('renders the workspace hub entry in the mobile More sheet', async () => {
    const { DashboardMobileMoreSheet } = await import(
      '../components/dashboard/mobile-bottom-nav'
    );
    const html = renderToStaticMarkup(
      <DashboardMobileMoreSheet
        role="admin"
        name="Faiz"
        email="faiz@example.com"
        pathname="/dashboard"
        activeQuery=""
        open
        onOpenChange={() => undefined}
      />,
    );

    expect(html).toContain('Workspace');
    expect(html).toContain('Lumbung Tour Haramain');
    expect(html).toContain('Buat workspace baru');
    expect(html).toContain('Gabung workspace');
  });

  it('keeps the desktop workspace trigger available even with zero memberships', async () => {
    workspaceHubState = {
      ...workspaceHubState,
      memberships: [],
      activeWorkspaceId: null,
      activeWorkspaceName: 'Tidak ada workspace',
    };

    vi.doMock('@/lib/workspace-client', () => ({
      recoverWorkspaceScopeViolation: vi.fn(() => false),
      workspaceFetch: vi.fn(async () => ({
        ok: false,
      })),
    }));
    vi.doMock('@/lib/client-error', () => ({
      parseApiErrorResponse: vi.fn(async () => ({
        code: 'ERR',
        message: 'error',
      })),
    }));

    const { DashboardHeader } = await import('../components/dashboard/header');
    const html = renderToStaticMarkup(
      <DashboardHeader role="admin" name="Faiz" email="faiz@example.com" />,
    );

    expect(html).toContain('Tidak ada workspace');
    expect(html).toContain('Buat workspace baru');
    expect(html).toContain('Gabung workspace');
    expect(html).not.toContain('disabled=""');
  });
});
