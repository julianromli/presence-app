import { describe, expect, it } from 'vitest';

import {
  type DashboardNavigationConfig,
  getDashboardNavLabel,
  getDashboardNavigation,
  hasDashboardMoreContent,
  isDashboardMoreRouteActive,
  isDashboardPrimaryRouteHighlighted,
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
    expect(navigation.mobileSecondary).toEqual([]);
    expect(navigation.mobileAccountSection?.label).toBe('Akun');
    expect(hasDashboardMoreContent(navigation)).toBe(true);
  });

  it('preserves desktop-specific superadmin labels while keeping mobile labels compact', () => {
    const navigation = getDashboardNavigation('superadmin');
    const reportItem = navigation.desktopGroups
      .flatMap((group) => group.items)
      .find(
        (item) => item.href === '/dashboard/report',
      );
    const adminReportItem = getDashboardNavigation('admin').desktopGroups
      .flatMap((group) => group.items)
      .find((item) => item.href === '/dashboard/report');

    expect(reportItem).toBeDefined();
    expect(adminReportItem).toBeDefined();
    expect(getDashboardNavLabel(reportItem!, 'desktop')).toBe('Laporan & Device');
    expect(getDashboardNavLabel(reportItem!, 'mobile')).toBe('Laporan');
    expect(getDashboardNavLabel(adminReportItem!, 'desktop')).toBe('Laporan');
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
      isDashboardMoreRouteActive('/dashboard/users', navigation.mobileSecondary),
    ).toBe(false);
  });

  it('suppresses primary route highlighting while the More sheet is open', () => {
    expect(
      isDashboardPrimaryRouteHighlighted('/dashboard/report', '/dashboard/report', false),
    ).toBe(true);
    expect(
      isDashboardPrimaryRouteHighlighted('/dashboard/report', '/dashboard/report', true),
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

  it('keeps More available when account access exists without secondary routes', () => {
    const navigation: DashboardNavigationConfig = {
      desktopGroups: [],
      desktopFooter: null,
      mobilePrimary: [],
      mobileSecondary: [],
      mobileAccountSection: {
        icon: getDashboardNavigation('karyawan').mobileAccountSection!.icon,
        label: 'Akun',
      },
      mobileAccountActions: [],
    };

    expect(hasDashboardMoreContent(navigation)).toBe(true);
  });
});
