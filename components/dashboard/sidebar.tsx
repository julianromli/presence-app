'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import {
  Buildings,
  ChartBar,
  MapPinArea,
  SquaresFour,
  UsersThree,
  Question,
} from '@phosphor-icons/react/dist/ssr';

type SidebarProps = {
  role?: string;
  name?: string;
  email?: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; weight?: 'regular' | 'fill' | 'bold' }>;
  badge?: string;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
  requiresRole?: string[];
};

const navigationGroups: NavGroup[] = [
  {
    label: 'Operasional',
    items: [
      { href: '/dashboard', label: 'Ringkasan', icon: SquaresFour },
      { href: '/dashboard/report', label: 'Laporan', icon: ChartBar },
      { href: '/dashboard/users', label: 'Karyawan', icon: UsersThree },
    ]
  },
  {
    label: 'Pengaturan',
    requiresRole: ['superadmin'],
    items: [
      { href: '/settings/workspace', label: 'Workspace', icon: Buildings },
      { href: '/settings/geofence', label: 'Geofence', icon: MapPinArea },
    ]
  }
];

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarItem({
  item,
  active,
}: {
  item: NavItem;
  active?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group flex w-full items-center justify-between rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${active
        ? 'bg-zinc-200/60 text-zinc-900'
        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
        }`}
    >
      <span className="flex items-center gap-3">
        <Icon weight={active ? 'bold' : 'regular'} className={`h-4 w-4 ${active ? 'text-zinc-900' : 'text-zinc-500 group-hover:text-zinc-900'}`} />
        {item.label}
      </span>
      {item.badge ? (
        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function DashboardSidebar({ role = 'karyawan', name, email }: SidebarProps) {
  const pathname = usePathname();

  const visibleGroups = navigationGroups.filter(
    (group) => !group.requiresRole || group.requiresRole.includes(role)
  );

  return (
    <aside className="hidden w-[240px] shrink-0 border-r border-zinc-200 bg-[#F9FAFB] md:flex md:flex-col">
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5 pb-24">
        {visibleGroups.map((group, index) => (
          <section key={index} className="flex flex-col gap-1">
            {group.label ? (
              <p className="px-3 pb-1 text-[11px] font-medium text-zinc-400 capitalize">{group.label}</p>
            ) : null}
            {group.items.map((item) => (
              <SidebarItem
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
              />
            ))}
          </section>
        ))}
      </nav>

      <div className="border-t border-zinc-200 bg-[#F9FAFB] p-3">
        <Link
          href="/dashboard/help"
          className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <Question weight="regular" className="h-4 w-4 text-zinc-500 group-hover:text-zinc-900" />
          Bantuan & Panduan
        </Link>
      </div>
    </aside>
  );
}
