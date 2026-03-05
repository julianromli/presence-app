'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ComponentType } from 'react';
import {
  Buildings,
  ChartBar,
  MapPinArea,
  SquaresFour,
  UsersThree,
  Question,
} from '@phosphor-icons/react/dist/ssr';
import { useSidebar } from '@/components/providers/sidebar-provider';

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

export function DashboardSidebar({ role = 'karyawan', name, email }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isCollapsed } = useSidebar();
  const activeQuery = (searchParams.get('q') ?? '').trim();

  const resolveItemHref = (href: string) => {
    if (!activeQuery) return href;
    const params = new URLSearchParams();
    params.set('q', activeQuery);
    return `${href}?${params.toString()}`;
  };

  const visibleGroups = navigationGroups.filter(
    (group) => !group.requiresRole || group.requiresRole.includes(role)
  );

  return (
    <aside className={`hidden shrink-0 border-r border-zinc-200 bg-[#F9FAFB] md:flex md:flex-col transition-all duration-300 ${isCollapsed ? 'w-[68px]' : 'w-[240px]'}`}>
      <nav className={`flex flex-1 flex-col gap-6 overflow-y-auto pt-5 pb-24 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {visibleGroups.map((group, index) => (
          <section key={index} className="flex flex-col gap-1">
            {group.label && !isCollapsed ? (
              <p className="px-3 pb-1 text-[11px] font-medium text-zinc-400 capitalize">{group.label}</p>
            ) : null}
            {isCollapsed && index > 0 && (
              <div className="mx-auto my-2 h-[1px] w-8 bg-zinc-200" />
            )}
            {group.items.map((item) => (
              <SidebarItem
                key={item.href}
                item={{ ...item, href: resolveItemHref(item.href) }}
                active={isActive(pathname, item.href)}
                isCollapsed={isCollapsed}
              />
            ))}
          </section>
        ))}
      </nav>

      <div className={`border-t border-zinc-200 bg-[#F9FAFB] ${isCollapsed ? 'p-2' : 'p-3'}`}>
        <Link
          href="/dashboard/help"
          title={isCollapsed ? "Bantuan & Panduan" : undefined}
          className={`group flex items-center rounded-md text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 ${isCollapsed ? 'h-10 w-10 justify-center mx-auto' : 'gap-3 px-3 py-2'}`}
        >
          <Question weight="regular" className="h-[18px] w-[18px] text-zinc-500 group-hover:text-zinc-900 shrink-0" />
          {!isCollapsed && <span>Bantuan & Panduan</span>}
        </Link>
      </div>
    </aside>
  );
}

function SidebarItem({
  item,
  active,
  isCollapsed,
}: {
  item: NavItem;
  active?: boolean;
  isCollapsed?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={isCollapsed ? item.label : undefined}
      className={`group flex w-full items-center rounded-md px-3 py-2 text-[13px] font-medium transition-all ${active
        ? 'bg-zinc-200/60 text-zinc-900'
        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
        } ${isCollapsed ? 'justify-center px-0 h-10 w-10 mx-auto' : 'justify-between'}`}
    >
      <span className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
        <Icon weight={active ? 'bold' : 'regular'} className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-zinc-900' : 'text-zinc-500 group-hover:text-zinc-900'}`} />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </span>
      {!isCollapsed && item.badge && (
        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
          {item.badge}
        </span>
      )}
    </Link>
  );
}
