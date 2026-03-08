'use client';

import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { AttendanceFilters } from '@/lib/attendance-filters';

type AttendanceWorkspaceFiltersProps = {
  filters: AttendanceFilters;
  isLoading: boolean;
  onSubmit: () => void;
  onRefresh: () => void;
  onReset: () => void;
  onChange: (patch: Partial<AttendanceFilters>) => void;
};

export function AttendanceWorkspaceFilters({
  filters,
  isLoading,
  onSubmit,
  onRefresh,
  onReset,
  onChange,
}: AttendanceWorkspaceFiltersProps) {
  return (
    <section className="sticky top-3 z-10 rounded-xl border border-zinc-200 bg-white/95 p-5 shadow-sm backdrop-blur">
      <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_180px_160px_auto]">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-700">Tanggal</span>
          <Popover>
            <PopoverTrigger>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'h-9 w-full justify-start border-zinc-200 bg-white px-3 text-left text-sm font-normal',
                  !filters.dateKey && 'text-zinc-500',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                {filters.dateKey ? format(new Date(`${filters.dateKey}T00:00:00`), 'dd MMM yyyy') : 'Pilih tanggal'}
              </Button>
            </PopoverTrigger>
            <PopoverPopup className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateKey ? new Date(`${filters.dateKey}T00:00:00`) : undefined}
                onSelect={(date) => {
                  if (date) {
                    onChange({ dateKey: format(date, 'yyyy-MM-dd') });
                  }
                }}
                initialFocus
              />
            </PopoverPopup>
          </Popover>
        </div>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-700">Cari karyawan</span>
          <Input
            value={filters.q}
            onChange={(event) => onChange({ q: event.target.value })}
            placeholder="Nama karyawan"
            className="h-9"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-700">Status attendance</span>
          <select
            value={filters.status}
            onChange={(event) => onChange({ status: event.target.value as AttendanceFilters['status'] })}
            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
          >
            <option value="all">Semua</option>
            <option value="not-checked-in">Belum check-in</option>
            <option value="checked-in">Sudah check-in</option>
            <option value="incomplete">Belum check-out</option>
            <option value="completed">Lengkap</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-700">Status edit</span>
          <select
            value={filters.edited}
            onChange={(event) => onChange({ edited: event.target.value as AttendanceFilters['edited'] })}
            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
          >
            <option value="all">Semua</option>
            <option value="true">Edited</option>
            <option value="false">Original</option>
          </select>
        </label>

        <div className="flex items-end gap-2">
          <Button type="button" onClick={onSubmit} disabled={isLoading}>
            {isLoading ? 'Memuat...' : 'Terapkan'}
          </Button>
          <Button type="button" variant="outline" onClick={onRefresh} disabled={isLoading}>
            Refresh
          </Button>
          <Button type="button" variant="outline" onClick={onReset} disabled={isLoading}>
            Reset
          </Button>
        </div>
      </div>
    </section>
  );
}
