import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NOINDEX_METADATA } from '../lib/seo';

function mockNoopProviders() {
  vi.doMock('@/components/providers/app-clerk-provider', () => ({
    AppClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  }));
  vi.doMock('@/components/dashboard/layout', () => ({
    DashboardLayout: ({ children }: { children: React.ReactNode }) => children,
  }));
  vi.doMock('@/lib/auth', () => ({
    requireWorkspaceOnboardingPage: vi.fn(),
    requireWorkspaceRolePageFromDb: vi.fn(),
  }));
  vi.doMock('next/navigation', () => ({
    redirect: vi.fn(),
  }));
}

describe('seo metadata boundaries', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('keeps the root layout free of a global canonical', async () => {
    vi.doMock('../app/globals.css', () => ({}));
    vi.doMock('next/font/google', () => ({
      DM_Sans: () => ({ variable: 'font-dm-sans' }),
      Fira_Code: () => ({ variable: 'font-fira-code' }),
      Manrope: () => ({ variable: 'font-manrope' }),
    }));
    vi.doMock('next/script', () => ({
      default: () => null,
    }));
    vi.doMock('@/components/theme-provider', () => ({
      ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
    }));
    vi.doMock('@/lib/runtime-flags', () => ({
      shouldLoadReactGrabScripts: () => false,
    }));

    const layoutModule = await import('../app/layout');

    expect(layoutModule.metadata.alternates).toBeUndefined();
  });

  it('keeps canonical metadata only on public marketing pages', async () => {
    vi.doMock('next/link', () => ({
      default: ({ children }: { children: React.ReactNode }) => children,
    }));
    vi.doMock('@/components/ui/button', () => ({
      Button: ({ children }: { children: React.ReactNode }) => children,
    }));
    vi.doMock('@/components/sections/legal-article', () => ({
      default: ({ children }: { children: React.ReactNode }) => children,
    }));
    vi.doMock('@/lib/runtime-flags', () => ({
      shouldUseLightweightMarketingHome: () => false,
    }));

    const homeModule = await import('../app/(marketing)/page');
    const privacyModule = await import('../app/(marketing)/privacy/page');
    const termsModule = await import('../app/(marketing)/terms/page');

    expect(homeModule.metadata.alternates?.canonical).toBe('/');
    expect(privacyModule.metadata.alternates?.canonical).toBe('/privacy');
    expect(termsModule.metadata.alternates?.canonical).toBe('/terms');
  });

  it('marks internal route boundaries as noindex', async () => {
    mockNoopProviders();

    const routeModules = await Promise.all([
      import('../app/(auth)/layout'),
      import('../app/auth/layout'),
      import('../app/(dashboard)/layout'),
      import('../app/dashboard/layout'),
      import('../app/settings/layout'),
      import('../app/scan/layout'),
      import('../app/device-qr/layout'),
      import('../app/onboarding/layout'),
      import('../app/mockup/layout'),
      import('../app/sentry-example-page/layout'),
    ]);

    for (const routeModule of routeModules) {
      expect(routeModule.metadata).toEqual(NOINDEX_METADATA);
    }
  });
});
