'use client';

import { UserButton } from '@clerk/nextjs';
import { Bell, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';

const titleByPathname: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/report': 'Manajemen Kehadiran',
  '/dashboard/users': 'Manajemen Karyawan',
  '/settings/geofence': 'Pengaturan Geofence',
};

function getPageTitle(pathname: string) {
  if (titleByPathname[pathname]) {
    return titleByPathname[pathname];
  }

  if (pathname.startsWith('/dashboard/users')) {
    return 'Manajemen Karyawan';
  }

  return 'Presence';
}

export function DashboardTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialValue = useMemo(() => searchParams.get('q') ?? '', [searchParams]);
  const [searchValue, setSearchValue] = useState(initialValue);

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

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
      <h1 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
        {getPageTitle(pathname)}
      </h1>

      <div className="flex items-center gap-3 md:gap-4">
        <form onSubmit={handleSubmit} className="hidden sm:block">
          <label className="relative block w-60 md:w-80">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
              placeholder="Cari pada halaman aktif"
            />
          </label>
        </form>
        <button
          type="button"
          className="relative rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 active:scale-[0.98]"
          aria-label="Lihat notifikasi"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
        </button>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
