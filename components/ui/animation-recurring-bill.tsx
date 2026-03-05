'use client';

import {
  ArrowsClockwise,
  Broadcast,
  CheckCircle,
  DeviceMobile,
  ShieldCheck,
  WarningCircle,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import {
  FeaturePreviewShell,
  type FeaturePreviewState,
} from './feature-preview-shell';

export type AnimatedShadowSvgProps = {
  className?: string;
  state?: FeaturePreviewState;
};

type DeviceMode = 'scanner' | 'monitor';

const DEVICES = [
  { id: 'd-1', name: 'QR-07 Lobby', status: 'online' as const, latency: '94 ms' },
  { id: 'd-2', name: 'QR-03 Gudang', status: 'online' as const, latency: '121 ms' },
  { id: 'd-3', name: 'QR-11 Site B', status: 'warning' as const, latency: 'Sinkronisasi ulang' },
];

export default function AnimatedShadowSvg({
  className,
  state = 'ready',
}: AnimatedShadowSvgProps) {
  const [mode, setMode] = useState<DeviceMode>('scanner');
  const [activeDevice, setActiveDevice] = useState(DEVICES[0]?.id ?? '');

  const active = useMemo(() => DEVICES.find((item) => item.id === activeDevice) ?? DEVICES[0], [activeDevice]);

  return (
    <FeaturePreviewShell
      className={className}
      state={state}
      emptyTitle="Belum ada device aktif"
      emptyDescription="Node scanner akan muncul saat device online."
      errorTitle="Node scanner gagal dibaca"
      errorDescription="Status device belum bisa dimuat. Coba sinkronisasi ulang."
    >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">Device Mode</p>
          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
            <Broadcast className="size-3.5 text-emerald-600" weight="fill" />
            Live node
          </span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {(['scanner', 'monitor'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`rounded-xl border px-3 py-2 text-left text-xs transition active:scale-[0.98] ${
                mode === item ? 'border-zinc-300 bg-zinc-100 text-zinc-900' : 'border-zinc-200 text-zinc-500'
              }`}
            >
              {item === 'scanner' ? 'Scanner' : 'Monitoring'}
            </button>
          ))}
        </div>

        <div className="mb-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
            <span>Endpoint aktif</span>
            <span className="inline-flex items-center gap-1 text-zinc-700">
              <ArrowsClockwise className="size-3.5" />
              5 dtk
            </span>
          </div>

          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
              className="grid size-11 place-items-center rounded-xl border border-zinc-200 bg-white"
            >
              <DeviceMobile className="size-5 text-zinc-700" weight="duotone" />
            </motion.div>
            <div>
              <p className="text-sm font-medium text-zinc-900">{active.name}</p>
              <p className="text-xs text-zinc-500">{mode === 'scanner' ? 'Mode scan cepat' : 'Mode observasi'} • {active.latency}</p>
            </div>
          </div>

          <div className="mt-3 h-2 rounded-full bg-zinc-200">
            <motion.div
              key={mode}
              initial={{ width: '40%' }}
              animate={{ width: mode === 'scanner' ? '88%' : '73%' }}
              transition={{ type: 'spring', stiffness: 110, damping: 22 }}
              className="h-full rounded-full bg-zinc-900"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {DEVICES.map((device, index) => {
              const isActive = activeDevice === device.id;
              const online = device.status === 'online';
              return (
                <motion.button
                  layout
                  key={device.id}
                  type="button"
                  onClick={() => setActiveDevice(device.id)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, type: 'spring', stiffness: 104, damping: 20 }}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition active:scale-[0.98] ${
                    isActive ? 'border-zinc-300 bg-white' : 'border-zinc-200 bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-800">{device.name}</span>
                    {online ? (
                      <CheckCircle className="size-3.5 text-emerald-600" weight="fill" />
                    ) : (
                      <WarningCircle className="size-3.5 text-amber-600" weight="fill" />
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-zinc-500">
                    <span>{device.latency}</span>
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="size-3.5" />
                      Token aman
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
    </FeaturePreviewShell>
  );
}
