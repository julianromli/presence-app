'use client';

import { Button } from '@/components/ui/button';
import { type GeofenceSearchResult } from '@/lib/geofence-geocoder';
import { type GeofencePoint } from '@/lib/geofence-map';

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

type GeofenceSearchResultsProps = {
  error: string | null;
  results: GeofenceSearchResult[];
  selectedPoint: GeofencePoint | null;
  status: SearchStatus;
  onSelect: (result: GeofenceSearchResult) => void;
};

function matchesSelectedPoint(
  selectedPoint: GeofencePoint | null,
  result: GeofenceSearchResult,
) {
  return (
    selectedPoint?.latitude === result.latitude &&
    selectedPoint?.longitude === result.longitude
  );
}

export function GeofenceSearchResults({
  error,
  results,
  selectedPoint,
  status,
  onSelect,
}: GeofenceSearchResultsProps) {
  if (status === 'loading') {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
        Mencari lokasi...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-900">
        {error}
      </div>
    );
  }

  if (status === 'success' && results.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
        Lokasi tidak ditemukan. Coba kata kunci yang lebih spesifik.
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {results.map((result) => {
        const isSelected = matchesSelectedPoint(selectedPoint, result);

        return (
          <Button
            key={result.id}
            type="button"
            variant="outline"
            className={`h-auto w-full justify-start px-3 py-3 text-left ${
              isSelected ? 'border-primary/40 bg-primary/5' : ''
            }`}
            onClick={() => onSelect(result)}
          >
            <span className="flex flex-col items-start gap-1">
              <span className="text-sm font-medium text-zinc-900">{result.label}</span>
              <span className="text-xs text-zinc-500">
                {result.latitude.toFixed(6)}, {result.longitude.toFixed(6)}
              </span>
            </span>
          </Button>
        );
      })}
    </div>
  );
}
