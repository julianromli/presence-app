import { describe, expect, it } from 'vitest';

import { getVisibleMarketingNavItems } from '@/components/layout/navbar-client';

describe('marketing navbar', () => {
  it('keeps public links for signed-out visitors', () => {
    expect(
      getVisibleMarketingNavItems(false, null).map((item) => item.href),
    ).toEqual(['/', '/#fitur', '/#integrasi', '/#faq']);
  });

  it('does not expose role-scoped links without a resolved role', () => {
    expect(
      getVisibleMarketingNavItems(true, null).map((item) => item.href),
    ).toEqual(['/', '/#fitur', '/#integrasi', '/#faq']);
  });

  it('shows the dashboard link for admin roles', () => {
    expect(
      getVisibleMarketingNavItems(true, 'admin').map((item) => item.href),
    ).toContain('/dashboard');
  });

  it('shows the device link for device-qr roles', () => {
    expect(
      getVisibleMarketingNavItems(true, 'device-qr').map((item) => item.href),
    ).toContain('/device-qr');
  });
});
