'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ComponentType, FormEvent, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  Buildings,
  ChartBar,
  MagnifyingGlass,
  MapPinArea,
  ShieldCheck,
  SquaresFour,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr';

type SidebarProps = {
  role: string;
  name: string;
  email: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; weight?: 'regular' }>;
  badge?: string;
};

const mainMenuItems: NavItem[] = [
  { href: '/dashboard', label: 'Ringkasan', icon: SquaresFour },
  { href: '/dashboard/report', label: 'Laporan', icon: ChartBar },
  { href: '/dashboard/users', label: 'Karyawan', icon: UsersThree },
];

const settingsItems: NavItem[] = [
  { href: '/settings/workspace', label: 'Workspace', icon: Buildings },
  { href: '/settings/geofence', label: 'Geofence', icon: MapPinArea },
];

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarItem({
  icon,
  label,
  active,
  href,
  badge,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  href: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex w-full items-center justify-between rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
        active
          ? 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/20'
          : 'text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <span className={active ? 'text-emerald-300' : 'text-zinc-400 group-hover:text-zinc-200'}>{icon}</span>
        {label}
      </span>
      {badge ? (
        <span className="rounded bg-emerald-600/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function DashboardSidebar({ role, name, email }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialValue = useMemo(() => searchParams.get('q') ?? '', [searchParams]);
  const [searchValue, setSearchValue] = useState(initialValue);

  const visibleSettingsItems =
    role === 'superadmin' ? settingsItems : settingsItems.filter(() => false);

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

  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-zinc-800 bg-zinc-900 text-zinc-100 md:flex md:flex-col">
      <div className="border-b border-zinc-800 px-4 py-4">
        <form onSubmit={handleSubmit}>
          <label className="relative block">
            <MagnifyingGlass
              weight="regular"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 pl-10 pr-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-500/50"
              placeholder="Cari data dashboard..."
              aria-label="Cari data dashboard"
            />
          </label>
        </form>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
        <section className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Operasional</p>
          {mainMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <SidebarItem
                key={item.href}
                href={item.href}
                icon={<Icon weight="regular" className="h-[18px] w-[18px]" />}
                label={item.label}
                active={isActive(pathname, item.href)}
                badge={item.badge}
              />
            );
          })}
        </section>

        {visibleSettingsItems.length > 0 ? (
          <section className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Pengaturan</p>
            {visibleSettingsItems.map((item) => {
              const Icon = item.icon;
              return (
                <SidebarItem
                  key={item.href}
                  href={item.href}
                  icon={<Icon weight="regular" className="h-[18px] w-[18px]" />}
                  label={item.label}
                  active={isActive(pathname, item.href)}
                />
              );
            })}
          </section>
        ) : null}
      </nav>

      <div className="border-t border-zinc-800 px-4 py-4">
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-zinc-800 text-xs font-semibold text-zinc-200">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-100">{name}</p>
              <p className="truncate text-xs text-zinc-400">{email}</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                <ShieldCheck weight="regular" className="h-3 w-3" />
                {role}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
