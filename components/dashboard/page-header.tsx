import type { ReactNode } from 'react';

type DashboardPageHeaderProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: ReactNode;
  onActionClick?: () => void;
  actionVariant?: 'default' | 'outline';
};

export function DashboardPageHeader({
  title,
  description,
  actionLabel,
  actionIcon,
  onActionClick,
  actionVariant = 'default',
}: DashboardPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-8 px-4 md:px-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">{title}</h1>
        </div>
        {description && (
          <p className="mt-1 text-[13px] text-zinc-500">{description}</p>
        )}
      </div>

      {actionLabel ? (
        <button
          onClick={onActionClick}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${actionVariant === 'default'
            ? 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm'
            : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 shadow-sm'
            }`}
        >
          {actionIcon}
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
