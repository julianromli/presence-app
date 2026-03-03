'use client';

import { SignOutButton } from '@clerk/nextjs';
import { BarChart3, LayoutDashboard, MapPinned, UserRound, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type MobileBottomNavProps = {
  role: string;
  name: string;
  email: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const baseItems: NavItem[] = [
  { href: '/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { href: '/dashboard/report', label: 'Laporan', icon: BarChart3 },
  { href: '/dashboard/users', label: 'Karyawan', icon: Users },
];

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav({ role, name, email }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const items =
    role === 'superadmin'
      ? [...baseItems, { href: '/settings/geofence', label: 'Geofence', icon: MapPinned }]
      : baseItems;

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        <ul className="grid grid-cols-4 gap-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition active:scale-[0.98]',
                    active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
          {role !== 'superadmin' ? (
            <li>
              <button
                type="button"
                onClick={() => setAccountOpen((prev) => !prev)}
                className={cn(
                  'flex w-full flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition active:scale-[0.98]',
                  accountOpen ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <UserRound className="h-4 w-4" />
                Akun
              </button>
            </li>
          ) : null}
        </ul>
      </nav>

      {role !== 'superadmin' && accountOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/30 md:hidden">
          <button
            type="button"
            aria-label="Tutup panel akun"
            className="absolute inset-0"
            onClick={() => setAccountOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-20 mx-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <p className="text-sm font-semibold text-slate-900">{name}</p>
            <p className="mt-1 text-xs text-slate-500">{email}</p>
            <p className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
              {role}
            </p>
            <SignOutButton>
              <Button type="button" variant="outline" className="mt-4 w-full">
                Keluar
              </Button>
            </SignOutButton>
          </div>
        </div>
      ) : null}
    </>
  );
}
