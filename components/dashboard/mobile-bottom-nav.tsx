'use client';

import { SignOutButton, UserButton } from '@clerk/nextjs';
import {
  DotsThreeCircle,
  CaretRight,
} from '@phosphor-icons/react/dist/ssr';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import {
  getDashboardNavLabel,
  getDashboardNavigation,
  hasDashboardMoreContent,
  isDashboardMoreRouteActive,
  isDashboardRouteActive,
  resolveDashboardNavHref,
} from '@/components/dashboard/navigation-config';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type MobileBottomNavProps = {
  role: string;
  name: string;
  email: string;
};

type DashboardMobileMoreSheetProps = {
  role: string;
  name: string;
  email: string;
  pathname: string;
  activeQuery: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DashboardMobileMoreSheet({
  role,
  name,
  email,
  pathname,
  activeQuery,
  open,
  onOpenChange,
}: DashboardMobileMoreSheetProps) {
  const navigation = getDashboardNavigation(role);
  const manageAccountAction = navigation.mobileAccountActions.find(
    (item) => item.key === 'manage-account',
  );
  const signOutAction = navigation.mobileAccountActions.find(
    (item) => item.key === 'sign-out',
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPopup
        side="bottom"
        showCloseButton={false}
        className="mx-auto max-h-[min(82vh,680px)] max-w-md overflow-hidden rounded-t-[30px] border-border bg-background md:hidden"
      >
        <SheetHeader className="border-b border-border/50 pb-4 text-left">
          <div className="mx-auto mb-1 h-1.5 w-12 rounded-full bg-muted-foreground/25" />
          <SheetTitle className="text-xl font-bold">More</SheetTitle>
          <SheetDescription>
            Shortcut tambahan dashboard dan akses akun dalam satu panel.
          </SheetDescription>
        </SheetHeader>

        <SheetPanel className="space-y-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          {navigation.mobileSecondary.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Navigasi
                </p>
                <p className="text-xs text-muted-foreground">
                  {navigation.mobileSecondary.length} item
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {navigation.mobileSecondary.map((item) => {
                  const active = isDashboardRouteActive(pathname, item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={resolveDashboardNavHref(item.href, activeQuery)}
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        'rounded-[22px] border px-4 py-4 transition-colors',
                        active
                          ? 'border-primary/20 bg-primary/8 text-primary'
                          : 'border-border/60 bg-card text-foreground hover:bg-secondary/50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Icon
                            weight={active ? 'fill' : 'regular'}
                            className={cn(
                              'h-5 w-5',
                              active ? 'text-primary' : 'text-muted-foreground',
                            )}
                          />
                          <p className="mt-3 text-sm font-semibold">
                            {getDashboardNavLabel(item, 'mobile')}
                          </p>
                        </div>
                        <CaretRight
                          weight="bold"
                          className={cn(
                            'mt-0.5 h-4 w-4',
                            active ? 'text-primary' : 'text-muted-foreground',
                          )}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {navigation.mobileAccountSection ? (
            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {navigation.mobileAccountSection.label}
              </p>

              <div className="rounded-[24px] border border-border/60 bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{name}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{email}</p>
                    <p className="mt-3 inline-flex rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-secondary-foreground">
                      {role}
                    </p>
                    {manageAccountAction ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {manageAccountAction.label} lewat kontrol Clerk di panel ini.
                      </p>
                    ) : null}
                  </div>

                  <div className="shrink-0">
                    <UserButton
                      afterSignOutUrl="/"
                      appearance={{
                        elements: {
                          userButtonAvatarBox:
                            'h-11 w-11 rounded-full ring-1 ring-border shadow-sm',
                        },
                      }}
                    />
                  </div>
                </div>

                <SignOutButton>
                  <Button type="button" variant="outline" className="mt-4 w-full rounded-full">
                    {signOutAction?.label ?? 'Keluar'}
                  </Button>
                </SignOutButton>
              </div>
            </section>
          ) : null}
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}

export function MobileBottomNav({ role, name, email }: MobileBottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [moreState, setMoreState] = useState({ open: false, pathname });
  const activeQuery = (searchParams.get('q') ?? '').trim();
  const navigation = getDashboardNavigation(role);
  const showMore = hasDashboardMoreContent(navigation);
  const moreOpen = moreState.open && moreState.pathname === pathname;
  const moreActive =
    moreOpen || isDashboardMoreRouteActive(pathname, navigation.mobileSecondary);

  const dockItems = showMore
    ? [
        ...navigation.mobilePrimary.map((item) => ({
          key: item.href,
          kind: 'route' as const,
          item,
        })),
        {
          key: 'more',
          kind: 'more' as const,
        },
      ]
    : navigation.mobilePrimary.map((item) => ({
        key: item.href,
        kind: 'route' as const,
        item,
      }));

  return (
    <>
      <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50 flex w-full justify-center px-4 md:hidden">
        <div
          className={cn(
            'pointer-events-auto relative flex w-full items-center justify-between overflow-hidden rounded-full border border-border/50 bg-background/90 p-1.5 shadow-[0_14px_36px_rgba(15,23,42,0.16)] backdrop-blur-2xl',
            showMore ? 'max-w-[360px]' : 'max-w-[320px]',
          )}
        >
          {dockItems.map((dockItem) => {
            if (dockItem.kind === 'more') {
              return (
                <button
                  key={dockItem.key}
                  type="button"
                  onClick={() =>
                    setMoreState((prev) => ({
                      open: prev.pathname === pathname ? !prev.open : true,
                      pathname,
                    }))
                  }
                  className="group relative z-10 flex h-[60px] flex-1 flex-col items-center justify-center py-2 outline-none"
                >
                  {moreActive ? (
                    <motion.div
                      layoutId="dashboard-mobile-nav-indicator"
                      className="absolute inset-0 -z-10 rounded-full bg-primary/10"
                      initial={false}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  ) : null}
                  <DotsThreeCircle
                    weight={moreActive ? 'fill' : 'regular'}
                    className={cn(
                      'mb-1 h-[22px] w-[22px] transition-colors duration-300',
                      moreActive
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-foreground',
                    )}
                  />
                  <span
                    className={cn(
                      'text-[11px] transition-colors duration-300',
                      moreActive
                        ? 'font-bold text-primary'
                        : 'font-medium text-muted-foreground group-hover:text-foreground',
                    )}
                  >
                    More
                  </span>
                </button>
              );
            }

            const { item } = dockItem;
            const active = isDashboardRouteActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={dockItem.key}
                href={resolveDashboardNavHref(item.href, activeQuery)}
                className="group relative z-10 flex h-[60px] flex-1 flex-col items-center justify-center py-2 outline-none"
              >
                {active ? (
                  <motion.div
                    layoutId="dashboard-mobile-nav-indicator"
                    className="absolute inset-0 -z-10 rounded-full bg-primary/10"
                    initial={false}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                ) : null}
                <Icon
                  weight={active ? 'fill' : 'regular'}
                  className={cn(
                    'mb-1 h-[22px] w-[22px] transition-colors duration-300',
                    active
                      ? 'text-primary'
                      : 'text-muted-foreground group-hover:text-foreground',
                  )}
                />
                <span
                  className={cn(
                    'text-[11px] transition-colors duration-300',
                    active
                      ? 'font-bold text-primary'
                      : 'font-medium text-muted-foreground group-hover:text-foreground',
                  )}
                >
                  {getDashboardNavLabel(item, 'mobile')}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {showMore ? (
        <DashboardMobileMoreSheet
          role={role}
          name={name}
          email={email}
          pathname={pathname}
          activeQuery={activeQuery}
          open={moreOpen}
          onOpenChange={(open) => setMoreState({ open, pathname })}
        />
      ) : null}
    </>
  );
}
