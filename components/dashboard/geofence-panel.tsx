'use client';

import dynamic from 'next/dynamic';
import { FormEvent, startTransition, useEffect, useState } from 'react';

import {
  buildGeofencePanelState,
  selectGeofencePoint,
  selectGeofenceSearchResult,
  validateGeofenceSettings,
  type SettingsPayload,
} from '@/components/dashboard/geofence-panel-state';
import { GeofenceSearchBox } from '@/components/dashboard/geofence-search-box';
import { GeofenceSearchResults } from '@/components/dashboard/geofence-search-results';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseApiErrorResponse } from '@/lib/client-error';
import {
  searchGeofenceLocations,
  type GeofenceSearchResult,
} from '@/lib/geofence-geocoder';
import {
  DEFAULT_GEOFENCE_VIEWPORT,
  type GeofencePoint,
  type GeofenceViewport,
} from '@/lib/geofence-map';
import { recoverWorkspaceScopeViolation, workspaceFetch } from '@/lib/workspace-client';

type NoticeTone = 'info' | 'success' | 'warning' | 'error';
type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

type InlineNotice = {
  tone: NoticeTone;
  text: string;
};

const GeofenceMapPicker = dynamic(
  () =>
    import('@/components/dashboard/geofence-map-picker').then((mod) => mod.GeofenceMapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] animate-pulse rounded-xl border border-zinc-200 bg-white" />
    ),
  },
);

function noticeClass(tone: NoticeTone) {
  switch (tone) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'error':
      return 'border-rose-200 bg-rose-50/50 text-rose-900';
    default:
      return 'border-zinc-200 bg-zinc-50 text-zinc-900';
  }
}

function formatCoordinate(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(6) : '-';
}

export function GeofencePanel() {
  const [data, setData] = useState<SettingsPayload>({
    timezone: 'Asia/Jakarta',
    geofenceEnabled: false,
    geofenceRadiusMeters: 100,
    minLocationAccuracyMeters: 100,
    geofenceLat: undefined,
    geofenceLng: undefined,
    whitelistEnabled: false,
    whitelistIps: [],
  });
  const [selectedPoint, setSelectedPoint] = useState<GeofencePoint | null>(null);
  const [mapViewport, setMapViewport] = useState<GeofenceViewport>(DEFAULT_GEOFENCE_VIEWPORT);
  const [ipText, setIpText] = useState('');
  const [notice, setNotice] = useState<InlineNotice | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<GeofenceSearchResult[]>([]);

  const setPanelFromData = (nextData: SettingsPayload) => {
    const panelState = buildGeofencePanelState(nextData);
    setData(panelState.data);
    setSelectedPoint(panelState.selectedPoint);
    setMapViewport(panelState.viewport);
  };

  const updateSelectedPoint = (point: GeofencePoint | null) => {
    startTransition(() => {
      const nextState = selectGeofencePoint(
        {
          data,
          selectedPoint,
          viewport: mapViewport,
        },
        point,
      );

      setData(nextState.data);
      setSelectedPoint(nextState.selectedPoint);
      setMapViewport(nextState.viewport);
    });
  };

  useEffect(() => {
    const load = async () => {
      const res = await workspaceFetch('/api/admin/settings', { cache: 'no-store' });
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res, 'Gagal memuat data geofence.');
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          return;
        }
        setNotice({ tone: 'error', text: `[${parsed.code}] ${parsed.message}` });
        setInitialLoading(false);
        return;
      }

      const payload = (await res.json()) as SettingsPayload;
      startTransition(() => {
        setPanelFromData({
          ...payload,
          minLocationAccuracyMeters: payload.minLocationAccuracyMeters ?? 100,
        });
        setIpText((payload.whitelistIps ?? []).join(', '));
        setSearchStatus('idle');
        setSearchError(null);
        setSearchResults([]);
        setInitialLoading(false);
      });
    };

    void load();
  }, []);

  const geofenceValidationErrors = validateGeofenceSettings(data);
  const hasBlockingValidationErrors = geofenceValidationErrors.length > 0;
  const showsBlockingGeofenceWarning =
    data.geofenceEnabled && geofenceValidationErrors.length > 0;

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchStatus('error');
      setSearchError('Masukkan nama lokasi atau alamat sebelum mencari.');
      setSearchResults([]);
      return;
    }

    setSearchStatus('loading');
    setSearchError(null);

    try {
      const results = await searchGeofenceLocations(searchQuery);

      startTransition(() => {
        setSearchResults(results);
        setSearchStatus('success');
      });
    } catch (error) {
      setSearchResults([]);
      setSearchStatus('error');
      setSearchError(
        error instanceof Error
          ? error.message
          : 'Gagal mencari lokasi. Coba lagi beberapa saat.',
      );
    }
  };

  const handleSearchSelect = (result: GeofenceSearchResult) => {
    startTransition(() => {
      const nextState = selectGeofenceSearchResult(
        {
          data,
          selectedPoint,
          viewport: mapViewport,
        },
        result,
      );

      setData(nextState.data);
      setSelectedPoint(nextState.selectedPoint);
      setMapViewport(nextState.viewport);
      setSearchError(null);
    });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();

    if (hasBlockingValidationErrors) {
      setNotice({
        tone: 'error',
        text: 'Pengaturan geofence belum valid. Perbaiki konfigurasi sebelum menyimpan.',
      });
      return;
    }

    setLoading(true);
    setNotice({ tone: 'info', text: 'Menyimpan pengaturan geofence...' });

    try {
      const whitelistIps = ipText
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean);

      const res = await workspaceFetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, whitelistIps }),
      });

      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res, 'Gagal menyimpan pengaturan geofence.');
        if (recoverWorkspaceScopeViolation(parsed.code)) {
          return;
        }
        setNotice({ tone: 'error', text: `[${parsed.code}] ${parsed.message}` });
        return;
      }

      setNotice({ tone: 'success', text: 'Pengaturan geofence berhasil disimpan.' });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl border border-zinc-200 bg-white" />
        <div className="h-64 animate-pulse rounded-xl border border-zinc-200 bg-white" />
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-8 animate-in fade-in duration-500 pb-20">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
        <p className="text-sm font-semibold tracking-tight text-zinc-900">Kebijakan lokasi & jaringan</p>
        <p className="mt-1 text-sm text-zinc-600">
          Atur area absensi, whitelist jaringan, dan kontrol validasi scan sesuai kebijakan kantor.
        </p>
        {showsBlockingGeofenceWarning ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            Geofence sedang aktif tetapi konfigurasinya belum valid. Scan karyawan akan ditolak
            sampai titik lokasi, radius, dan batas akurasi GPS diperbaiki.
          </div>
        ) : null}
        {notice ? (
          <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${noticeClass(notice.tone)}`}>
            {notice.text}
          </div>
        ) : null}
      </section>

      <div className="space-y-6">
        <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Lokasi geofence</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Cari lokasi kantor, klik titik di peta, lalu geser marker untuk menempatkan pusat
            geofence dengan presisi.
          </p>
          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
            <div className="space-y-5">
              <label className="space-y-1">
                <span className="text-sm font-medium text-zinc-700">Timezone</span>
                <Input
                  value={data.timezone}
                  onChange={(event) =>
                    setData((prev) => ({ ...prev, timezone: event.target.value }))
                  }
                />
              </label>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-zinc-700">Cari alamat atau gedung</p>
                  <p className="text-xs text-zinc-500">
                    Hasil pencarian tidak otomatis menyimpan konfigurasi.
                  </p>
                </div>
                <GeofenceSearchBox
                  query={searchQuery}
                  isSearching={searchStatus === 'loading'}
                  onQueryChange={setSearchQuery}
                  onSubmit={() => void handleSearch()}
                />
                <GeofenceSearchResults
                  error={searchError}
                  results={searchResults}
                  selectedPoint={selectedPoint}
                  status={searchStatus}
                  onSelect={handleSearchSelect}
                />
              </div>

              <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                    Latitude
                  </p>
                  <p className="text-sm font-semibold text-zinc-900">
                    {formatCoordinate(data.geofenceLat)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                    Longitude
                  </p>
                  <p className="text-sm font-semibold text-zinc-900">
                    {formatCoordinate(data.geofenceLng)}
                  </p>
                </div>
              </div>

              <label className="space-y-1">
                <span className="text-sm font-medium text-zinc-700">Radius Geofence (meter)</span>
                <Input
                  type="number"
                  min={10}
                  value={data.geofenceRadiusMeters}
                  onChange={(event) =>
                    setData((prev) => ({
                      ...prev,
                      geofenceRadiusMeters: Math.max(10, Number(event.target.value) || 10),
                    }))
                  }
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-zinc-700">
                  Batas Akurasi GPS Maksimum (meter)
                </span>
                <Input
                  type="number"
                  min={1}
                  value={data.minLocationAccuracyMeters}
                  onChange={(event) =>
                    setData((prev) => ({
                      ...prev,
                      minLocationAccuracyMeters: Math.max(1, Number(event.target.value) || 1),
                    }))
                  }
                />
                <p className="text-xs text-zinc-500">
                  Scan ditolak jika ketidakpastian GPS lebih buruk dari batas ini.
                </p>
              </label>

              {geofenceValidationErrors.length > 0 ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-900">
                  {geofenceValidationErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <GeofenceMapPicker
                selectedPoint={selectedPoint}
                viewport={mapViewport}
                onPointSelect={updateSelectedPoint}
              />
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
                Gunakan pencarian untuk mendekati area kantor, lalu klik atau geser marker untuk
                menentukan titik absensi yang paling akurat.
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Aturan tambahan</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-zinc-800">Aktifkan Geofence</p>
                <p className="text-xs text-zinc-500">Scan harus berada dalam radius kantor.</p>
              </div>
              <input
                type="checkbox"
                checked={data.geofenceEnabled}
                onChange={(event) =>
                  setData((prev) => ({ ...prev, geofenceEnabled: event.target.checked }))
                }
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-zinc-800">Aktifkan IP Whitelist</p>
                <p className="text-xs text-zinc-500">Hanya IP kantor yang diizinkan untuk scan.</p>
              </div>
              <input
                type="checkbox"
                checked={data.whitelistEnabled}
                onChange={(event) =>
                  setData((prev) => ({ ...prev, whitelistEnabled: event.target.checked }))
                }
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-zinc-700">Whitelist IP (pisahkan koma)</span>
              <Input value={ipText} onChange={(event) => setIpText(event.target.value)} />
            </label>
          </div>
        </article>
      </div>

      <div className="sticky bottom-20 z-10 flex items-center justify-end gap-3 rounded-xl border border-zinc-200 bg-white/95 p-4 shadow-sm backdrop-blur md:bottom-3">
        <Button
          type="submit"
          disabled={loading || hasBlockingValidationErrors}
          className="min-w-40"
          isLoading={loading}
          loadingText="Menyimpan..."
        >
          Simpan Perubahan
        </Button>
      </div>
    </form>
  );
}
