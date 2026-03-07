'use client';

import {
  ActivityIcon,
  Buildings,
  ChartBar,
  CircleNotch,
  Clock,
  DeviceMobileCamera,
  FileText,
  Gauge,
  MapPin,
  UsersThree,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';

type PanelKey = 'overview' | 'team' | 'reports';
type RangeKey = '7d' | '30d';

type Kpi = {
  label: string;
  value: string;
  delta: string;
  icon: ComponentType<{ className?: string; weight?: 'duotone' | 'regular' }>;
};

const PANELS: Array<{ key: PanelKey; label: string; icon: ComponentType<{ className?: string }> }> = [
  { key: 'overview', label: 'Ringkasan', icon: Gauge },
  { key: 'team', label: 'Karyawan', icon: UsersThree },
  { key: 'reports', label: 'Laporan', icon: FileText },
];

const KPI_BY_PANEL: Record<PanelKey, Kpi[]> = {
  overview: [
    { label: 'Karyawan aktif', value: '128', delta: '+12.4%', icon: UsersThree },
    { label: 'Check-in hari ini', value: '113', delta: '+8.1%', icon: ActivityIcon },
    { label: 'Rasio kehadiran', value: '88.7%', delta: '+4.5%', icon: ChartBar },
    { label: 'Device online', value: '12', delta: '+2 unit', icon: DeviceMobileCamera },
  ],
  team: [
    { label: 'Karyawan onsite', value: '82', delta: '+5.2%', icon: Buildings },
    { label: 'Karyawan remote', value: '46', delta: '+1.1%', icon: UsersThree },
    { label: 'Telat check-in', value: '9', delta: '-2.4%', icon: Clock },
    { label: 'Geofence aktif', value: '6', delta: '100%', icon: MapPin },
  ],
  reports: [
    { label: 'Report mingguan', value: '18', delta: '+3 report', icon: FileText },
    { label: 'Anomali scan', value: '4', delta: '-1 issue', icon: ActivityIcon },
    { label: 'Kepatuhan SOP', value: '93.1%', delta: '+2.6%', icon: ChartBar },
    { label: 'Lokasi audit', value: '14', delta: '+2 lokasi', icon: MapPin },
  ],
};

const TREND_BY_RANGE: Record<RangeKey, Array<{ day: string; value: number }>> = {
  '7d': [
    { day: 'Jum', value: 62 },
    { day: 'Sab', value: 57 },
    { day: 'Min', value: 64 },
    { day: 'Sen', value: 81 },
    { day: 'Sel', value: 84 },
    { day: 'Rab', value: 79 },
    { day: 'Kam', value: 88 },
  ],
  '30d': [
    { day: 'M1', value: 66 },
    { day: 'M2', value: 71 },
    { day: 'M3', value: 75 },
    { day: 'M4', value: 83 },
    { day: 'M5', value: 87 },
    { day: 'M6', value: 80 },
    { day: 'M7', value: 89 },
  ],
};

const ACTIVITY_FEED: Array<{ id: string; user: string; action: string; time: string; status: 'ok' | 'warning' }> = [
  { id: '1', user: 'Nadia Putri', action: 'Check-in kantor pusat', time: '08:13', status: 'ok' },
  { id: '2', user: 'Raka Dirgantara', action: 'Check-out cabang Depok', time: '08:27', status: 'ok' },
  { id: '3', user: 'Salsa Mahardika', action: 'Butuh verifikasi lokasi', time: '08:35', status: 'warning' },
  { id: '4', user: 'Bagas Pratama', action: 'Check-in via device QR-07', time: '08:41', status: 'ok' },
];

function DeltaBadge({ value }: { value: string }) {
  const isPositive = value.startsWith('+') || value.includes('100%');
  return (
    <span
      className={`rounded-full border px-2 py-1 text-[10px] font-medium ${
        isPositive
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      {value}
    </span>
  );
}

export function DashboardHeroMockup() {
  const [activePanel, setActivePanel] = useState<PanelKey>('overview');
  const [range, setRange] = useState<RangeKey>('7d');
  const [selectedActivity, setSelectedActivity] = useState<string>('1');

  const kpis = useMemo(() => KPI_BY_PANEL[activePanel], [activePanel]);
  const trend = useMemo(() => TREND_BY_RANGE[range], [range]);

  return (
    <div className="relative overflow-hidden rounded-t-[16px] border border-zinc-200/80 bg-zinc-50/80 p-2 shadow-[0_20px_60px_-20px_rgba(24,24,27,0.18)] backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/80 to-transparent" />
      <div className="relative grid min-h-[520px] grid-cols-1 overflow-hidden rounded-[12px] border border-zinc-200/70 bg-white md:grid-cols-[228px_1fr]">
        <aside className="border-b border-zinc-200 bg-zinc-100/80 p-4 md:border-r md:border-b-0">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-xl bg-zinc-950 text-xs font-semibold text-white">P</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900">Absensi.id Studio</p>
              <p className="text-xs text-zinc-500">Marketing Preview</p>
            </div>
          </div>

          <nav className="grid gap-2">
            {PANELS.map((panel) => {
              const Icon = panel.icon;
              const isActive = panel.key === activePanel;
              return (
                <button
                  key={panel.key}
                  type="button"
                  onClick={() => setActivePanel(panel.key)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-all duration-300 active:scale-[0.98] ${
                    isActive
                      ? 'border-zinc-300 bg-white text-zinc-900 shadow-[0_8px_20px_-15px_rgba(24,24,27,0.4)]'
                      : 'border-transparent text-zinc-600 hover:border-zinc-300 hover:bg-white/70'
                  }`}
                >
                  <Icon className="size-4" />
                  <span>{panel.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-3">
            <p className="text-xs font-semibold tracking-wide text-zinc-700 uppercase">Status data realtime</p>
            <div className="mt-2 flex items-center gap-2">
              <CircleNotch className="size-4 animate-spin text-emerald-600" />
              <p className="text-xs text-zinc-600">Sinkron 2.4 detik lalu</p>
            </div>
          </div>
        </aside>

        <section className="bg-white p-4 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-[0.14em] text-zinc-500 uppercase">Dashboard interaktif</p>
              <h3 className="text-2xl font-semibold tracking-tight text-zinc-900">Ringkasan Operasional</h3>
            </div>

            <div className="flex rounded-xl border border-zinc-200 bg-zinc-50 p-1">
              {(['7d', '30d'] as RangeKey[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRange(item)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-300 active:scale-[0.98] ${
                    range === item ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  {item === '7d' ? '7 hari' : '30 hari'}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activePanel}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
            >
              {kpis.map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <article key={kpi.label} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs text-zinc-500">{kpi.label}</span>
                      <Icon className="size-4 text-zinc-500" weight="duotone" />
                    </div>
                    <p className="text-2xl font-semibold tracking-tight text-zinc-900">{kpi.value}</p>
                    <div className="mt-3">
                      <DeltaBadge value={kpi.delta} />
                    </div>
                  </article>
                );
              })}
            </motion.div>
          </AnimatePresence>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <article className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-zinc-800">Tren kehadiran</h4>
                <p className="text-xs text-zinc-500">Update otomatis</p>
              </div>

              <div className="grid h-40 grid-cols-7 items-end gap-2">
                {trend.map((bar, index) => (
                  <motion.div
                    key={`${range}-${bar.day}`}
                    initial={{ scaleY: 0.2, opacity: 0.5 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.45, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformOrigin: 'bottom' }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div
                      className="w-full rounded-full bg-zinc-900/90"
                      style={{ height: `${Math.max(22, (bar.value / 100) * 120)}px` }}
                    />
                    <span className="text-[10px] text-zinc-500">{bar.day}</span>
                  </motion.div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-zinc-800">Aktivitas terakhir</h4>
                <span className="text-xs text-zinc-500">{ACTIVITY_FEED.length} event</span>
              </div>

              <div className="grid gap-2">
                {ACTIVITY_FEED.map((item) => {
                  const isSelected = item.id === selectedActivity;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedActivity(item.id)}
                      className={`rounded-xl border px-3 py-2 text-left text-xs transition-all duration-300 active:scale-[0.98] ${
                        isSelected
                          ? 'border-zinc-300 bg-white text-zinc-900'
                          : 'border-zinc-200 bg-zinc-100/70 text-zinc-600 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{item.user}</span>
                        <span className="text-zinc-500">{item.time}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate">{item.action}</span>
                        <span
                          className={`h-2 w-2 rounded-full ${
                            item.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
