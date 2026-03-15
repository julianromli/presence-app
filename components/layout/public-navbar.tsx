'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { ThemeToggle } from '../ui/theme-toggle';

const ITEMS = [
  { label: 'Beranda', href: '/' },
  { label: 'Fitur', href: '/#fitur' },
  { label: 'Integrasi', href: '/#integrasi' },
  { label: 'FAQ', href: '/#faq' },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href.startsWith('/#')) {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicNavbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-background border-border sticky top-0 z-50 border-b px-2.5 lg:px-0">
      <div className="container grid h-20 grid-cols-[auto_1fr_auto] items-center lg:grid-cols-[1fr_auto_1fr]">
        <Link
          href="/"
          className="flex items-center justify-self-start"
          aria-label="Absenin.id"
        >
          <Image
            src="/absenin-id-logo.png"
            alt="Absenin.id"
            width={512}
            height={512}
            className="h-8 w-auto"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-8 justify-self-center lg:flex">
          {ITEMS.map((link) => (
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

        <div className="hidden items-center gap-2 justify-self-end lg:flex">
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
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-2 justify-self-end lg:hidden">
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
            {ITEMS.map((link) => (
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
          </nav>
        </div>
      ) : null}
    </header>
  );
}
