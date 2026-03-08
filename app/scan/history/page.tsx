import { Suspense } from 'react';

import { HistoryPanel } from './history-panel';

function HistoryPageFallback() {
  return (
    <div className="min-h-screen bg-secondary/30 pb-20">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-6">
        <div className="rounded-[24px] border border-border/60 bg-card p-4 shadow-sm">
          <div className="h-5 w-32 animate-pulse rounded-full bg-secondary" />
          <div className="mt-3 h-4 w-48 animate-pulse rounded-full bg-secondary/80" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-10 animate-pulse rounded-2xl bg-secondary/80"
              />
            ))}
          </div>
        </div>

        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[24px] border border-border/60 bg-card p-4 shadow-sm"
          >
            <div className="h-5 w-40 animate-pulse rounded-full bg-secondary" />
            <div className="mt-3 h-4 w-32 animate-pulse rounded-full bg-secondary/80" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="h-16 animate-pulse rounded-2xl bg-secondary/80" />
              <div className="h-16 animate-pulse rounded-2xl bg-secondary/80" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistoryPageFallback />}>
      <HistoryPanel />
    </Suspense>
  );
}
