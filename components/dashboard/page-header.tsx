import type { ReactNode } from 'react';

type DashboardPageHeaderProps = {
  title: string;
  actionLabel?: string;
  actionIcon?: ReactNode;
  onActionClick?: () => void;
};

export function DashboardPageHeader({
  title,
  actionLabel,
  actionIcon,
  onActionClick,
}: DashboardPageHeaderProps) {
  return (
    <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 md:px-6">
      <h1 className="text-[18px] font-semibold text-zinc-900">{title}</h1>
      {actionLabel ? (
        <button
          onClick={onActionClick}
          className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
        >
          {actionIcon}
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
