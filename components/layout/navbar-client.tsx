'use client';

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { AppRole } from '@/lib/auth';
import { cn } from '@/lib/utils';

import { ThemeToggle } from '../ui/theme-toggle';

type NavItem = {
  label: string;
  href: string;
  roles?: AppRole[];
};

export type NavbarClientProps = {
  isSignedIn: boolean;
  role: AppRole | null;
};

const ITEMS: NavItem[] = [
  { label: 'Beranda', href: '/' },
  { label: 'Fitur', href: '/#fitur' },
  { label: 'Integrasi', href: '/#integrasi' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Dashboard', href: '/dashboard', roles: ['admin', 'superadmin'] },
  { label: 'QR Device', href: '/device-qr', roles: ['device-qr'] },
];

function isActivePath(pathname: string, href: string) {
  if (href.startsWith('/#')) {
    return pathname === '/';
  }

  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isAllowed(item: NavItem, isSignedIn: boolean, role: AppRole | null) {
  if (!item.roles) {
    return true;
  }

  if (!isSignedIn || !role) {
    return false;
  }

  return item.roles.includes(role);
}

export function NavbarClient({ isSignedIn, role }: NavbarClientProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const visibleItems = useMemo(
    () => ITEMS.filter((item) => isAllowed(item, isSignedIn, role)),
    [isSignedIn, role],
  );

  return (
    <header className="bg-background border-border sticky top-0 z-50 border-b px-2.5 lg:px-0">
      <div className="container flex h-20 items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Absenin.id
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {visibleItems.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={cn(
                'text-muted-foreground hover:text-foreground text-sm font-medium transition-colors',
                isActivePath(pathname, link.href) && 'text-foreground',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {isSignedIn ? (
            <UserButton afterSignOutUrl="/" />
          ) : (
            <>
              <Link href="/sign-in">
                <Button size="sm" variant="outline">
                  Masuk
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm" variant="default">
                  Daftar
                </Button>
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsMenuOpen((value) => !value)}
          >
            Menu
          </Button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="border-border border-t lg:hidden">
          <nav className="container flex flex-col gap-4 py-4">
            {visibleItems.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  'text-muted-foreground hover:text-foreground text-sm font-medium transition-colors',
                  isActivePath(pathname, link.href) && 'text-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}

            {isSignedIn ? (
              <div className="border-border border-t pt-3">
                <UserButton afterSignOutUrl="/" />
              </div>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link href="/sign-in" onClick={() => setIsMenuOpen(false)}>
                  <Button size="sm" variant="outline">
                    Masuk
                  </Button>
                </Link>
                <Link href="/sign-up" onClick={() => setIsMenuOpen(false)}>
                  <Button size="sm" variant="default">
                    Daftar
                  </Button>
                </Link>
              </div>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
