'use client';

import { X } from 'lucide-react';
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
            Presence MVP siap dipakai untuk absensi QR dinamis
          </span>
          <Button size="sm" variant="secondary" asChild>
            <a href="/dashboard">Buka Dashboard</a>
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
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Banner;
