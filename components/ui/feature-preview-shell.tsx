'use client';

import { Empty, WarningCircle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export type FeaturePreviewState = 'ready' | 'loading' | 'empty' | 'error';

type FeaturePreviewShellProps = {
  className?: string;
  state?: FeaturePreviewState;
  emptyTitle?: string;
  emptyDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
  onRetry?: () => void;
  children: ReactNode;
};

function LoadingState() {
  return (
    <div className="grid h-full animate-pulse gap-3">
      <div className="h-8 rounded-xl bg-zinc-100" />
      <div className="grid gap-2">
        <div className="h-16 rounded-xl bg-zinc-100" />
        <div className="h-16 rounded-xl bg-zinc-100" />
        <div className="h-16 rounded-xl bg-zinc-100" />
      </div>
    </div>
  );
}

export function FeaturePreviewShell({
  className,
  state = 'ready',
  emptyTitle = 'Belum ada data',
  emptyDescription = 'Data preview akan muncul saat aktivitas mulai masuk.',
  errorTitle = 'Gagal memuat preview',
  errorDescription = 'Coba muat ulang untuk sinkronisasi data terbaru.',
  onRetry,
  children,
}: FeaturePreviewShellProps) {
  return (
    <div className={className}>
      <div className="relative h-full overflow-hidden rounded-t-[16px] border border-zinc-200/80 bg-zinc-50/80 p-2 shadow-[0_20px_60px_-20px_rgba(24,24,27,0.18)]">
        <div className="relative h-full overflow-hidden rounded-[12px] border border-zinc-200/70 bg-white">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/80 to-transparent" />
          <div className="relative h-full p-4">
            {state === 'ready' && children}
            {state === 'loading' && <LoadingState />}
            {state === 'empty' && (
              <div className="grid h-full place-content-center gap-2 text-center">
                <Empty className="mx-auto size-8 text-zinc-400" />
                <p className="text-sm font-medium text-zinc-800">{emptyTitle}</p>
                <p className="max-w-[28ch] text-xs text-zinc-500">{emptyDescription}</p>
              </div>
            )}
            {state === 'error' && (
              <div className="grid h-full place-content-center gap-3 text-center">
                <WarningCircle className="mx-auto size-8 text-amber-600" weight="fill" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-800">{errorTitle}</p>
                  <p className="max-w-[30ch] text-xs text-zinc-500">{errorDescription}</p>
                </div>
                {onRetry ? (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mx-auto rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 active:scale-[0.98]"
                  >
                    Coba lagi
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
