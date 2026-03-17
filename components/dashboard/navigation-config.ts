import type { ComponentType } from 'react';
import {
  Buildings,
  ChartBar,
  ClockCounterClockwise,
  MapPinArea,
  QrCode,
  SquaresFour,
  Trophy,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr';

export type DashboardRole = 'karyawan' | 'admin' | 'superadmin';

type DashboardIcon = ComponentType<{
  className?: string;
  weight?: 'regular' | 'fill' | 'bold';
}>;

export type DashboardRouteItem = {
  href: string;
  icon: DashboardIcon;
  labels: {
    default: string;
    mobile?: string;
    desktop?: string;
  };
};

export type DashboardAccountSection = {
  icon: DashboardIcon;
  label: string;
};

export type DashboardActionItem = {
  icon: DashboardIcon;
  key: 'manage-account';
  label: string;
};

type DashboardDesktopGroup = {
  label: string;
  items: DashboardRouteItem[];
};

export type DashboardNavigationConfig = {
  desktopGroups: DashboardDesktopGroup[];
  desktopFooter: DashboardRouteItem | null;
  mobilePrimary: DashboardRouteItem[];
  mobileSecondary: DashboardRouteItem[];
  mobileAccountSection: DashboardAccountSection | null;
  mobileAccountActions: DashboardActionItem[];
};

const summaryItem: DashboardRouteItem = {
  href: '/dashboard',
  icon: SquaresFour,
  labels: {
    default: 'Ringkasan',
  },
};

const attendanceItem: DashboardRouteItem = {
  href: '/dashboard/attendance',
  icon: ClockCounterClockwise,
  labels: {
    default: 'Absensi',
    desktop: 'Absensi Saya',
  },
};

const leaderboardItem: DashboardRouteItem = {
  href: '/dashboard/leaderboard',
  icon: Trophy,
  labels: {
    default: 'Leaderboard',
  },
};

const adminReportItem: DashboardRouteItem = {
  href: '/dashboard/report',
  icon: ChartBar,
  labels: {
    default: 'Laporan',
  },
};

const superadminReportItem: DashboardRouteItem = {
  href: '/dashboard/report',
  icon: ChartBar,
  labels: {
    default: 'Laporan',
  },
};

const deviceQrItem: DashboardRouteItem = {
  href: '/dashboard/device-qr',
  icon: QrCode,
  labels: {
    default: 'Device QR',
  },
};

const usersItem: DashboardRouteItem = {
  href: '/dashboard/users',
  icon: UsersThree,
  labels: {
    default: 'Karyawan',
  },
};

const workspaceItem: DashboardRouteItem = {
  href: '/settings/workspace',
  icon: Buildings,
  labels: {
    default: 'Workspace',
  },
};

const geofenceItem: DashboardRouteItem = {
  href: '/settings/geofence',
  icon: MapPinArea,
  labels: {
    default: 'Geofence',
  },
};

const accountSection: DashboardAccountSection = {
  icon: UserCircle,
  label: 'Akun',
};

const accountActions: DashboardActionItem[] = [
  {
    key: 'manage-account',
    label: 'Kelola akun',
    icon: UserCircle,
  },
];

const navigationByRole: Record<DashboardRole, DashboardNavigationConfig> = {
  karyawan: {
    desktopGroups: [
      {
        label: 'Operasional',
        items: [summaryItem, attendanceItem, leaderboardItem],
      },
    ],
    desktopFooter: null,
    mobilePrimary: [summaryItem, attendanceItem, leaderboardItem],
    mobileSecondary: [],
    mobileAccountSection: accountSection,
    mobileAccountActions: accountActions,
  },
  admin: {
    desktopGroups: [
      {
        label: 'Operasional',
        items: [summaryItem, adminReportItem, usersItem],
      },
    ],
    desktopFooter: null,
    mobilePrimary: [summaryItem, adminReportItem, usersItem],
    mobileSecondary: [],
    mobileAccountSection: accountSection,
    mobileAccountActions: accountActions,
  },
  superadmin: {
    desktopGroups: [
      {
        label: 'Operasional',
        items: [summaryItem, superadminReportItem, deviceQrItem, usersItem],
      },
      {
        label: 'Pengaturan',
        items: [workspaceItem, geofenceItem],
      },
    ],
    desktopFooter: null,
    mobilePrimary: [summaryItem, superadminReportItem, usersItem],
    mobileSecondary: [deviceQrItem, workspaceItem, geofenceItem],
    mobileAccountSection: accountSection,
    mobileAccountActions: accountActions,
  },
};

const fallbackNavigation: DashboardNavigationConfig = {
  desktopGroups: [
    {
      label: 'Operasional',
      items: [summaryItem],
    },
  ],
  desktopFooter: null,
  mobilePrimary: [summaryItem],
  mobileSecondary: [],
  mobileAccountSection: null,
  mobileAccountActions: [],
};

export function getDashboardNavigation(role?: string): DashboardNavigationConfig {
  if (role === 'karyawan' || role === 'admin' || role === 'superadmin') {
    return navigationByRole[role];
  }

  return fallbackNavigation;
}

export function getDashboardNavLabel(
  item: DashboardRouteItem,
  surface: 'desktop' | 'mobile',
) {
  if (surface === 'desktop') {
    return item.labels.desktop ?? item.labels.default;
  }

  return item.labels.mobile ?? item.labels.default;
}

export function isDashboardRouteActive(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isDashboardMoreRouteActive(
  pathname: string,
  items: DashboardRouteItem[],
) {
  return items.some((item) => isDashboardRouteActive(pathname, item.href));
}

export function isDashboardPrimaryRouteHighlighted(
  pathname: string,
  href: string,
  moreOpen: boolean,
) {
  return !moreOpen && isDashboardRouteActive(pathname, href);
}

export function resolveDashboardNavHref(href: string, activeQuery: string) {
  if (!activeQuery) {
    return href;
  }

  const params = new URLSearchParams();
  params.set('q', activeQuery);
  return `${href}?${params.toString()}`;
}

export function hasDashboardMoreContent(config: DashboardNavigationConfig) {
  return (
    config.mobileSecondary.length > 0 ||
    config.mobileAccountSection !== null ||
    config.mobileAccountActions.length > 0
  );
}
