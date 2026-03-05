'use client';

import {
  CheckCircle,
  ClockCounterClockwise,
  Download,
  FileText,
  FunnelSimple,
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

type ReportStatus = 'queued' | 'ready';

const REPORTS: Array<{ id: string; label: string; period: string; status: ReportStatus; size: string }> = [
  { id: 'r-1', label: 'Rekap Kehadiran', period: '01-07 Mar 2026', status: 'ready', size: '2.3 MB' },
  { id: 'r-2', label: 'Audit Perubahan', period: '22-28 Feb 2026', status: 'ready', size: '1.7 MB' },
  { id: 'r-3', label: 'Anomali Lokasi', period: '15-21 Feb 2026', status: 'queued', size: 'Sedang proses' },
];

export default function AnimationPaymentLink({ className, state = 'ready' }: Props) {
  const [statusFilter, setStatusFilter] = useState<'all' | ReportStatus>('all');
  const [activeReportId, setActiveReportId] = useState(REPORTS[0]?.id ?? '');

  const visibleReports = useMemo(() => {
    if (statusFilter === 'all') return REPORTS;
    return REPORTS.filter((report) => report.status === statusFilter);
  }, [statusFilter]);

  return (
    <FeaturePreviewShell
      className={className}
      state={state}
      emptyTitle="Belum ada file ekspor"
      emptyDescription="Daftar file akan tampil setelah laporan pertama dibuat."
      errorTitle="Pusat laporan tidak tersedia"
      errorDescription="Terjadi kendala saat memuat status berkas report."
    >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">Report Center</p>
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-600">
            <ClockCounterClockwise className="size-3.5" />
            Auto-sync
          </span>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
          <FunnelSimple className="size-4 text-zinc-500" />
          <div className="ml-auto flex rounded-lg border border-zinc-200 bg-white p-1">
            {(['all', 'ready', 'queued'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatusFilter(item)}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase transition active:scale-[0.98] ${
                  statusFilter === item ? 'bg-zinc-900 text-white' : 'text-zinc-500'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {visibleReports.map((report, index) => {
              const active = activeReportId === report.id;
              const isReady = report.status === 'ready';
              return (
                <motion.button
                  layout
                  key={report.id}
                  type="button"
                  onClick={() => setActiveReportId(report.id)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ delay: index * 0.04, type: 'spring', stiffness: 105, damping: 21 }}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition active:scale-[0.98] ${
                    active ? 'border-zinc-300 bg-white' : 'border-zinc-200 bg-zinc-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-zinc-800">{report.label}</p>
                      <p className="mt-0.5 text-zinc-500">{report.period}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        isReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {report.status}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="size-3.5" />
                      {report.size}
                    </span>
                    {isReady ? (
                      <span className="inline-flex items-center gap-1 text-zinc-700">
                        <Download className="size-3.5" />
                        Download
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <ClockCounterClockwise className="size-3.5" />
                        Menunggu
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
            <span>Kesiapan ekspor</span>
            <span>2/3 file</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-200">
            <motion.div
              animate={{ width: '66%' }}
              transition={{ type: 'spring', stiffness: 100, damping: 21 }}
              className="h-full rounded-full bg-zinc-900"
            />
          </div>
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-zinc-600">
            <CheckCircle className="size-3.5 text-emerald-600" weight="fill" />
            Export terakhir berhasil 6 menit lalu
          </p>
        </div>
    </FeaturePreviewShell>
  );
}
