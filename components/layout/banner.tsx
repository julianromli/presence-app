'use client';

import { X } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const Banner = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="bg-primary relative">
      <div className="container flex items-center justify-between gap-4 py-3 pr-12">
        <div className="flex flex-1 items-center justify-center gap-3 sm:gap-4">
          <span className="text-primary-foreground text-center text-sm font-medium">
            Absenin.id siap dipakai untuk absensi QR dinamis real-time
          </span>
          <Button size="sm" variant="secondary" render={<Link href="/sign-up" />}>
            Daftar
          </Button>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className={cn(
            'absolute top-1/2 right-4 -translate-y-1/2 rounded-sm p-1.5',
            'text-primary-foreground/70 hover:text-primary-foreground',
            'transition-all duration-200 hover:scale-110 hover:bg-white/10',
            'focus:ring-2 focus:ring-white/30 focus:outline-none',
          )}
          aria-label="Close banner"
        >
          <X weight="regular" className="size-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Banner;

