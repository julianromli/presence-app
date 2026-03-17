import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

import { ThemeToggle } from '../ui/theme-toggle';

const ITEMS = [
  { label: 'Beranda', href: '/' },
  { label: 'Fitur', href: '/#fitur' },
  { label: 'Integrasi', href: '/#integrasi' },
  { label: 'FAQ', href: '/#faq' },
] as const;

export function PublicNavbar() {
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
          />
        </Link>

        <nav className="hidden items-center gap-8 justify-self-center lg:flex">
          {ITEMS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
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
          <details className="group relative">
            <summary className="border-input bg-popover text-foreground shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-disabled:not-active:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] hover:bg-accent/50 dark:bg-input/32 dark:hover:bg-input/64 relative inline-flex h-8 cursor-pointer list-none items-center justify-center rounded-lg border px-[calc(var(--spacing)_*_2.5_-_1px)] text-sm font-medium outline-none transition-shadow [&::-webkit-details-marker]:hidden">
              Menu
            </summary>

            <div className="bg-background border-border absolute right-0 top-[calc(100%+0.75rem)] z-50 hidden w-56 rounded-2xl border p-3 shadow-[0_24px_48px_-24px_rgba(13,13,18,0.25)] group-open:block">
              <nav className="flex flex-col gap-1">
                {ITEMS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground rounded-xl px-3 py-2 text-sm font-medium transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-3 flex gap-2 border-t border-zinc-200 pt-3">
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
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
