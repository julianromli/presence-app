'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ComponentType } from 'react';
import { FormEvent, useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronsUpDown,
  LayoutDashboard,
  MapPinned,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';

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

const mainMenuItems: NavItem[] = [
  { href: '/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { href: '/dashboard/report', label: 'Laporan', icon: BarChart3 },
  { href: '/dashboard/users', label: 'Karyawan', icon: Users },
];

const recordItems: NavItem[] = [{ href: '/settings/geofence', label: 'Geofence', icon: MapPinned }];

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar({ role, name, email }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialValue = useMemo(() => searchParams.get('q') ?? '', [searchParams]);
  const [searchValue, setSearchValue] = useState(initialValue);

  const visibleRecordItems =
    role === 'superadmin' ? recordItems : recordItems.filter((item) => item.href !== '/settings/geofence');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const params = new URLSearchParams(searchParams.toString());
    const trimmed = searchValue.trim();
    if (trimmed.length > 0) {
      params.set('q', trimmed);
    } else {
      params.delete('q');
    }
    const query = params.toString();
    router.push(query.length > 0 ? `${pathname}?${query}` : pathname);
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition duration-200 ${
          active ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
        }`}
      >
        <span
          className={`absolute inset-y-1 left-0 w-1 rounded-r-full transition ${
            active ? 'bg-indigo-500' : 'bg-transparent group-hover:bg-slate-300'
          }`}
        />
        <Icon className={`h-5 w-5 ${active ? 'text-indigo-500' : 'text-slate-400 group-hover:text-slate-600'}`} />
        <span className="tracking-[-0.01em]">{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className="hidden w-[300px] border-r border-slate-300 bg-slate-50 md:flex md:flex-col">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-center justify-between rounded-xl px-1 py-1">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-indigo-500 text-xs font-bold text-white">
              P
            </div>
            <p className="text-2xl font-semibold tracking-tight text-slate-900">Presence</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white p-2 text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
            aria-label="Sidebar options"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-y border-slate-300 px-5 py-5">
        <form onSubmit={handleSubmit}>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-4 text-base text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="Search"
              aria-label="Search dashboard"
            />
          </label>
        </form>
      </div>

      <nav className="flex-1 overflow-y-auto px-5 py-5">
        <div>
          <p className="px-3 pb-2 text-sm font-medium text-slate-400">Main Menu</p>
          <div className="space-y-1">{mainMenuItems.map(renderItem)}</div>
        </div>

        {visibleRecordItems.length > 0 ? (
          <div className="mt-7">
            <p className="px-3 pb-2 text-sm font-medium text-slate-400">Record</p>
            <div className="space-y-1">{visibleRecordItems.map(renderItem)}</div>
          </div>
        ) : null}
      </nav>

      <div className="border-t border-slate-300 px-5 py-4">
        <div className="flex items-start gap-3 rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
            <p className="truncate text-xs text-slate-500">{email}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              <ShieldCheck className="h-3 w-3" />
              {role}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
