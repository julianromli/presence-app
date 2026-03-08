'use client';

import { format } from 'date-fns';
import { CalendarIcon, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '@/components/ui/menu';
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover';
import {
  ATTENDANCE_EDITED_FILTER_OPTIONS,
  ATTENDANCE_STATUS_FILTER_OPTIONS,
  getAttendanceEditedFilterLabel,
  getAttendanceStatusFilterLabel,
  type AttendanceFilters,
} from '@/lib/attendance-filters';
import { cn } from '@/lib/utils';

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
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'h-9 w-full justify-start border-zinc-200 bg-white px-3 text-left text-sm font-normal',
                    !filters.dateKey && 'text-zinc-500',
                  )}
                />
              }
            >
              <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
              {filters.dateKey ? format(new Date(`${filters.dateKey}T00:00:00`), 'dd MMM yyyy') : 'Pilih tanggal'}
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
          <Menu>
            <MenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full justify-between border-zinc-200 bg-white px-3 text-sm font-normal"
                />
              }
            >
              {getAttendanceStatusFilterLabel(filters.status)}
              <ChevronDown className="h-4 w-4 opacity-70" />
            </MenuTrigger>
            <MenuPopup align="start" className="w-[var(--anchor-width)]">
              <MenuRadioGroup
                value={filters.status}
                onValueChange={(value) =>
                  onChange({ status: value as AttendanceFilters['status'] })
                }
              >
                {ATTENDANCE_STATUS_FILTER_OPTIONS.map((option) => (
                  <MenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuPopup>
          </Menu>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-700">Status edit</span>
          <Menu>
            <MenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full justify-between border-zinc-200 bg-white px-3 text-sm font-normal"
                />
              }
            >
              {getAttendanceEditedFilterLabel(filters.edited)}
              <ChevronDown className="h-4 w-4 opacity-70" />
            </MenuTrigger>
            <MenuPopup align="start" className="w-[var(--anchor-width)]">
              <MenuRadioGroup
                value={filters.edited}
                onValueChange={(value) =>
                  onChange({ edited: value as AttendanceFilters['edited'] })
                }
              >
                {ATTENDANCE_EDITED_FILTER_OPTIONS.map((option) => (
                  <MenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuPopup>
          </Menu>
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
