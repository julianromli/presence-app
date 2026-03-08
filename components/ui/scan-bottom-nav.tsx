'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClockCounterClockwise, Scan, User } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const TABS = [
  { href: '/scan', label: 'Scan', icon: Scan },
  { href: '/scan/history', label: 'Riwayat', icon: ClockCounterClockwise },
  { href: '/scan/profile', label: 'Profil', icon: User },
];

export function ScanBottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-6 w-full px-6 flex justify-center z-50 pointer-events-none">
      <div className="bg-background pointer-events-auto rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-border/40 p-1.5 flex items-center justify-between relative overflow-hidden backdrop-blur-2xl w-full max-w-[340px]">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex-1 flex flex-col items-center justify-center py-2 h-[60px] z-10 outline-none group"
            >
              {isActive && (
                <motion.div
                  layoutId="scan-bottom-nav-indicator"
                  className="absolute inset-0 bg-primary/10 rounded-full -z-10"
                  initial={false}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}
              <Icon
                weight={isActive ? 'fill' : 'regular'}
                className={cn(
                  'w-[22px] h-[22px] mb-1 transition-colors duration-300',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              <span
                className={cn(
                  'text-[11px] transition-colors duration-300',
                  isActive
                    ? 'font-bold text-primary'
                    : 'font-medium text-muted-foreground group-hover:text-foreground'
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
