'use client';

import { DownloadSimple, FileArrowDown, TrendUp } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import {
  FeaturePreviewShell,
  type FeaturePreviewState,
} from './feature-preview-shell';

type RangeKey = 'weekly' | 'monthly';

type Props = {
  className?: string;
  'aria-label'?: string;
  state?: FeaturePreviewState;
};

const DATA_BY_RANGE: Record<RangeKey, Array<{ label: string; value: number }>> = {
  weekly: [
    { label: 'Sen', value: 70 },
    { label: 'Sel', value: 75 },
    { label: 'Rab', value: 78 },
    { label: 'Kam', value: 86 },
    { label: 'Jum', value: 82 },
  ],
  monthly: [
    { label: 'M1', value: 68 },
    { label: 'M2', value: 74 },
    { label: 'M3', value: 79 },
    { label: 'M4', value: 87 },
    { label: 'M5', value: 91 },
  ],
};

export default function AnimationInvoicing({
  className,
  'aria-label': ariaLabel = 'Invoicing animation',
  state = 'ready',
}: Props) {
  const [range, setRange] = useState<RangeKey>('weekly');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const data = useMemo(() => DATA_BY_RANGE[range], [range]);
  const total = useMemo(() => data.reduce((acc, item) => acc + item.value, 0), [data]);

  return (
    <FeaturePreviewShell
      className={className}
      state={state}
      emptyTitle="Belum ada rekap"
      emptyDescription="Data mingguan dan bulanan akan muncul setelah sinkronisasi absensi."
      errorTitle="Rekap gagal diproses"
      errorDescription="Sistem belum bisa menyiapkan data ekspor saat ini."
    >
      <div aria-label={ariaLabel}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
            Rekap Ekspor
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100 active:scale-[0.98]"
          >
            <DownloadSimple className="size-3.5" />
            Unduh
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {(['weekly', 'monthly'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`rounded-xl border px-3 py-2 text-left text-xs transition active:scale-[0.98] ${
                range === key ? 'border-zinc-300 bg-zinc-100 text-zinc-900' : 'border-zinc-200 text-zinc-500'
              }`}
            >
              {key === 'weekly' ? 'Mingguan' : 'Bulanan'}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
            <span>Total kehadiran</span>
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <TrendUp className="size-3.5" />
              +4.2%
            </span>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-zinc-900">{total}</p>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={range}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.28 }}
              className="mt-3 grid h-24 grid-cols-5 items-end gap-2"
            >
              {data.map((item, index) => (
                <motion.div
                  key={`${range}-${item.label}`}
                  initial={{ scaleY: 0.2, opacity: 0.4 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  transition={{ delay: index * 0.04, type: 'spring', stiffness: 100, damping: 22 }}
                  style={{ transformOrigin: 'bottom' }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className="w-full rounded-full bg-zinc-900/90"
                    style={{ height: `${Math.max(16, (item.value / 100) * 84)}px` }}
                  />
                  <span className="text-[10px] text-zinc-500">{item.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2">
          <FileArrowDown className="size-4 text-zinc-500" />
          <span className="text-xs text-zinc-600">Format output</span>
          <div className="ml-auto flex gap-1">
            {(['xlsx', 'csv'] as const).map((ext) => (
              <button
                key={ext}
                type="button"
                onClick={() => setFormat(ext)}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide uppercase transition ${
                  format === ext ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                {ext}
              </button>
            ))}
          </div>
        </div>
      </div>
    </FeaturePreviewShell>
  );
}
