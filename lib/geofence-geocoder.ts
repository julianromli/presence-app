import { buildSelectedPoint } from '@/lib/geofence-map';

export type NominatimSearchResult = {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
};

export type GeofenceSearchResult = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export function mapNominatimResults(
  results: NominatimSearchResult[],
): GeofenceSearchResult[] {
  return results.flatMap((result) => {
    const selectedPoint = buildSelectedPoint(
      Number(result.lat),
      Number(result.lon),
    );

    if (!selectedPoint) {
      return [];
    }

    return [
      {
        id: String(result.place_id),
        label: result.display_name,
        ...selectedPoint,
      },
    ];
  });
}

export async function searchGeofenceLocations(
  query: string,
  fetcher: typeof fetch = fetch,
): Promise<GeofenceSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmedQuery,
    format: 'jsonv2',
    limit: '5',
    addressdetails: '0',
  });

  const response = await fetcher(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'id,en',
      },
    },
  );

  if (!response.ok) {
    throw new Error('Gagal mencari lokasi. Coba lagi beberapa saat.');
  }

  const payload = (await response.json()) as NominatimSearchResult[];
  return mapNominatimResults(payload).slice(0, 5);
}
