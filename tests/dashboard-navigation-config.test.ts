import { describe, expect, it } from 'vitest';

import {
  getDashboardNavLabel,
  getDashboardNavigation,
  hasDashboardMoreContent,
  isDashboardMoreRouteActive,
  resolveDashboardNavHref,
} from '../components/dashboard/navigation-config';

describe('dashboard navigation config', () => {
  it('maps karyawan mobile navigation to ringkasan, absensi, leaderboard, and more content', () => {
    const navigation = getDashboardNavigation('karyawan');

    expect(navigation.mobilePrimary.map((item) => item.href)).toEqual([
      '/dashboard',
      '/dashboard/attendance',
      '/dashboard/leaderboard',
    ]);
    expect(navigation.mobileSecondary.map((item) => item.href)).toEqual([
      '/dashboard/help',
    ]);
    expect(navigation.mobileAccountSection?.label).toBe('Akun');
    expect(hasDashboardMoreContent(navigation)).toBe(true);
  });

  it('preserves desktop-specific superadmin labels while keeping mobile labels compact', () => {
    const navigation = getDashboardNavigation('superadmin');
    const reportItem = navigation.desktopGroups[0]?.items.find(
      (item) => item.href === '/dashboard/report',
    );

    expect(reportItem).toBeDefined();
    expect(getDashboardNavLabel(reportItem!, 'desktop')).toBe('Laporan & Device');
    expect(getDashboardNavLabel(reportItem!, 'mobile')).toBe('Laporan');
  });

  it('treats secondary routes as active for the More tab', () => {
    const navigation = getDashboardNavigation('superadmin');

    expect(
      isDashboardMoreRouteActive('/settings/workspace', navigation.mobileSecondary),
    ).toBe(true);
    expect(
      isDashboardMoreRouteActive('/settings/geofence', navigation.mobileSecondary),
    ).toBe(true);
    expect(
      isDashboardMoreRouteActive('/dashboard/help', navigation.mobileSecondary),
    ).toBe(true);
    expect(
      isDashboardMoreRouteActive('/dashboard/users', navigation.mobileSecondary),
    ).toBe(false);
  });

  it('preserves the active q query when resolving navigation links', () => {
    expect(resolveDashboardNavHref('/dashboard/users', 'budi')).toBe(
      '/dashboard/users?q=budi',
    );
    expect(resolveDashboardNavHref('/dashboard/users', '')).toBe('/dashboard/users');
  });

  it('falls back to a safe minimal mobile navigation for malformed roles', () => {
    const navigation = getDashboardNavigation('device-qr');

    expect(navigation.mobilePrimary.map((item) => item.href)).toEqual(['/dashboard']);
    expect(navigation.mobileSecondary).toHaveLength(0);
    expect(navigation.mobileAccountSection).toBeNull();
    expect(hasDashboardMoreContent(navigation)).toBe(false);
  });
});
