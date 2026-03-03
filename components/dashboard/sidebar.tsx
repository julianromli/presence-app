'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import { BarChart3, LayoutDashboard, MapPinned, ShieldCheck, Users } from 'lucide-react';

type SidebarProps = {
  role: string;
  name: string;
  email: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { href: '/dashboard/report', label: 'Laporan', icon: BarChart3 },
  { href: '/dashboard/users', label: 'Karyawan', icon: Users },
  { href: '/settings/geofence', label: 'Geofence', icon: MapPinned },
];

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar({ role, name, email }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 border-r border-slate-200 bg-white md:flex md:flex-col">
      <div className="flex h-16 items-center border-b border-slate-200 px-6">
        <div className="mr-3 grid h-6 w-6 place-items-center rounded bg-slate-900 text-[10px] font-bold text-white">
          P
        </div>
        <p className="text-lg font-semibold tracking-tight text-slate-900">Presence</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-6">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{name}</p>
            <p className="truncate text-xs text-slate-500">{email}</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              <ShieldCheck className="h-3 w-3" />
              {role}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
