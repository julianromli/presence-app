"use client";

import { format } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/components/ui/menu";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import {
  ATTENDANCE_EDITED_FILTER_OPTIONS,
  ATTENDANCE_STATUS_FILTER_OPTIONS,
  getAttendanceEditedFilterLabel,
  getAttendanceStatusFilterLabel,
  type AttendanceFilters,
} from "@/lib/attendance-filters";
import { cn } from "@/lib/utils";

type AttendanceWorkspaceFiltersProps = {
  filters: AttendanceFilters;
  isLoading: boolean;
  pendingAction?: "submit" | "refresh" | "reset" | null;
  onSubmit: () => void;
  onRefresh: () => void;
  onReset: () => void;
  onChange: (patch: Partial<AttendanceFilters>) => void;
};

export function AttendanceWorkspaceFilters({
  filters,
  isLoading,
  pendingAction = null,
  onSubmit,
  onRefresh,
  onReset,
  onChange,
}: AttendanceWorkspaceFiltersProps) {
  const hasActiveSearch = filters.q.trim().length > 0;
  const hasStatusFilter = filters.status !== "all";
  const hasEditedFilter = filters.edited !== "all";
  const hasNarrowedScope =
    hasActiveSearch || hasStatusFilter || hasEditedFilter;

  return (
    <section className="sticky top-3 z-10 rounded-2xl border border-zinc-200 bg-white/92 px-4 py-4 shadow-sm backdrop-blur md:px-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-tight text-zinc-950">
              Filter review harian
            </p>
            <p className="text-xs text-zinc-500">
              Persempit daftar utama untuk menemukan pengecualian lebih cepat.
            </p>
          </div>
          <p className="text-xs text-zinc-500">
            {hasNarrowedScope
              ? "Filter aktif akan diterapkan ke tabel utama dan quick list."
              : "Belum ada filter tambahan aktif."}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_180px_160px]">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-zinc-700">Tanggal</span>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "h-9 w-full justify-start border-zinc-200 bg-white px-3 text-left text-sm font-normal",
                        !filters.dateKey && "text-zinc-500",
                      )}
                    />
                  }
                >
                  <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                  {filters.dateKey
                    ? format(
                        new Date(`${filters.dateKey}T00:00:00`),
                        "dd MMM yyyy",
                      )
                    : "Pilih tanggal"}
                </PopoverTrigger>
                <PopoverPopup className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      filters.dateKey
                        ? new Date(`${filters.dateKey}T00:00:00`)
                        : undefined
                    }
                    onSelect={(date) => {
                      if (date) {
                        onChange({ dateKey: format(date, "yyyy-MM-dd") });
                      }
                    }}
                    initialFocus
                  />
                </PopoverPopup>
              </Popover>
            </div>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-zinc-700">
                Cari karyawan
              </span>
              <Input
                value={filters.q}
                onChange={(event) => onChange({ q: event.target.value })}
                placeholder="Nama atau email karyawan"
                className="h-9"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-zinc-700">
                Status attendance
              </span>
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
                      onChange({ status: value as AttendanceFilters["status"] })
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
              <span className="text-xs font-medium text-zinc-700">
                Status edit
              </span>
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
                      onChange({ edited: value as AttendanceFilters["edited"] })
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
          </div>

          <div className="flex flex-wrap items-end gap-2 xl:justify-end">
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isLoading}
              isLoading={pendingAction === "submit"}
            >
              Terapkan
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onRefresh}
              disabled={isLoading}
              isLoading={pendingAction === "refresh"}
            >
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onReset}
              disabled={isLoading}
              isLoading={pendingAction === "reset"}
            >
              Reset
            </Button>
          </div>
        </div>

        {hasNarrowedScope ? (
          <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-600">
            {hasActiveSearch ? (
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">
                Pencarian:{" "}
                <span className="font-medium text-zinc-900">{filters.q}</span>
              </span>
            ) : null}
            {hasStatusFilter ? (
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">
                Status:{" "}
                <span className="font-medium text-zinc-900">
                  {getAttendanceStatusFilterLabel(filters.status)}
                </span>
              </span>
            ) : null}
            {hasEditedFilter ? (
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">
                Edit:{" "}
                <span className="font-medium text-zinc-900">
                  {getAttendanceEditedFilterLabel(filters.edited)}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
