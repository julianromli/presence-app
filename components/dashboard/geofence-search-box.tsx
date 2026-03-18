'use client';

import { KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type GeofenceSearchBoxProps = {
  disabled?: boolean;
  isSearching: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
};

export function GeofenceSearchBox({
  disabled = false,
  isSearching,
  query,
  onQueryChange,
  onSubmit,
}: GeofenceSearchBoxProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="search"
          value={query}
          disabled={disabled || isSearching}
          placeholder="Cari kantor, alamat, atau gedung"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          type="button"
          className="sm:min-w-28"
          disabled={disabled}
          isLoading={isSearching}
          loadingText="Mencari..."
          onClick={onSubmit}
        >
          Cari
        </Button>
      </div>
      <p className="text-xs text-zinc-500">
        Pencarian hanya dikirim saat Anda menekan Enter atau tombol cari.
      </p>
    </div>
  );
}
