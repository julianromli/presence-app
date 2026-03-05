'use client';

import {
  CheckCircle,
  CircleNotch,
  Clock,
  Scan,
  ShieldCheck,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import {
  FeaturePreviewShell,
  type FeaturePreviewState,
} from './feature-preview-shell';

type Props = {
  className?: string;
  state?: FeaturePreviewState;
};

type ScanMode = 'checkin' | 'checkout';

const MODE_STATS: Record<ScanMode, { title: string; ratio: string; color: string }> = {
  checkin: { title: 'Sukses check-in', ratio: '96.4%', color: 'bg-emerald-500' },
  checkout: { title: 'Sukses check-out', ratio: '94.1%', color: 'bg-zinc-900' },
};

const EVENTS = [
  { id: 'ev-1', name: 'Nadia Putri', time: '08:11', status: 'ok' as const },
  { id: 'ev-2', name: 'Raka Dirgantara', time: '08:16', status: 'ok' as const },
  { id: 'ev-3', name: 'Salsa Mahardika', time: '08:19', status: 'warn' as const },
  { id: 'ev-4', name: 'Bagas Pratama', time: '08:23', status: 'ok' as const },
];

export default function AnimationCheckout({ className, state = 'ready' }: Props) {
  const [mode, setMode] = useState<ScanMode>('checkin');
  const [selectedEvent, setSelectedEvent] = useState(EVENTS[0]?.id ?? '');

  const activeMetric = useMemo(() => MODE_STATS[mode], [mode]);

  return (
    <FeaturePreviewShell
      className={className}
      state={state}
      emptyTitle="Belum ada event scanner"
      emptyDescription="Preview check-in/check-out tampil saat scanner menerima QR pertama."
      errorTitle="Koneksi scanner terputus"
      errorDescription="Pastikan device QR online lalu sinkronkan ulang."
    >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
            QR Scanner
          </p>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <CircleNotch className="size-3.5 animate-spin text-emerald-600" />
            <span>Realtime</span>
          </div>
        </div>

        <div className="mb-4 flex rounded-xl border border-zinc-200 bg-zinc-50 p-1">
          {(['checkin', 'checkout'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition active:scale-[0.98] ${
                mode === item ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {item === 'checkin' ? 'Check-in' : 'Check-out'}
            </button>
          ))}
        </div>

        <article className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-zinc-500">{activeMetric.title}</span>
            <ShieldCheck className="size-4 text-zinc-500" />
          </div>
          <p className="text-2xl font-semibold tracking-tight text-zinc-900">{activeMetric.ratio}</p>
          <div className="mt-2 h-2 rounded-full bg-zinc-200">
            <motion.div
              key={mode}
              initial={{ width: '35%' }}
              animate={{ width: activeMetric.ratio }}
              transition={{ type: 'spring', stiffness: 110, damping: 22 }}
              className={`h-full rounded-full ${activeMetric.color}`}
            />
          </div>
        </article>

        <div className="mt-3 grid gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {EVENTS.map((event, index) => {
              const isActive = selectedEvent === event.id;
              return (
                <motion.button
                  layout
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEvent(event.id)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, type: 'spring', stiffness: 105, damping: 20 }}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition active:scale-[0.98] ${
                    isActive ? 'border-zinc-300 bg-white' : 'border-zinc-200 bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-800">{event.name}</span>
                    <span className="text-zinc-500">{event.time}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <Scan className="size-3.5" />
                      {mode === 'checkin' ? 'Masuk area valid' : 'Keluar area valid'}
                    </span>
                    {event.status === 'ok' ? (
                      <CheckCircle className="size-3.5 text-emerald-600" weight="fill" />
                    ) : (
                      <Clock className="size-3.5 text-amber-600" weight="fill" />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
    </FeaturePreviewShell>
  );
}
