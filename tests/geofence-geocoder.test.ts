import { describe, expect, it, vi } from 'vitest';

import {
  type NominatimSearchResult,
  mapNominatimResults,
  searchGeofenceLocations,
} from '@/lib/geofence-geocoder';

function buildResult(
  overrides: Partial<NominatimSearchResult> = {},
): NominatimSearchResult {
  return {
    place_id: 1,
    display_name: 'Jakarta, Indonesia',
    lat: '-6.200000',
    lon: '106.816666',
    ...overrides,
  };
}

describe('geofence geocoder', () => {
  it('maps raw Nominatim results into safe UI search candidates', () => {
    const results = mapNominatimResults([
      buildResult(),
      buildResult({
        place_id: 2,
        display_name: 'Invalid latitude',
        lat: 'not-a-number',
      }),
      buildResult({
        place_id: 3,
        display_name: 'Bandung, Indonesia',
        lat: '-6.917464',
        lon: '107.619123',
      }),
    ]);

    expect(results).toEqual([
      {
        id: '1',
        label: 'Jakarta, Indonesia',
        latitude: -6.2,
        longitude: 106.816666,
      },
      {
        id: '3',
        label: 'Bandung, Indonesia',
        latitude: -6.917464,
        longitude: 107.619123,
      },
    ]);
  });

  it('limits successful searches to the top five mapped results', async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        Array.from({ length: 6 }, (_, index) =>
          buildResult({
            place_id: index + 1,
            display_name: `Place ${index + 1}`,
            lat: `${-6.2 + index * 0.01}`,
            lon: `${106.8 + index * 0.01}`,
          }),
        ),
      ),
    );

    const results = await searchGeofenceLocations('Jakarta', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(5);
    expect(results[0]?.label).toBe('Place 1');
    expect(results[4]?.label).toBe('Place 5');
  });

  it('throws a recoverable error when the Nominatim request fails', async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        { error: 'rate limited' },
        { status: 429, statusText: 'Too Many Requests' },
      ),
    );

    await expect(searchGeofenceLocations('Jakarta', fetcher)).rejects.toThrow(
      /gagal mencari lokasi/i,
    );
  });
});
