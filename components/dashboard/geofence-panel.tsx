'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '@/components/ui/menu';
import { parseApiErrorResponse } from '@/lib/client-error';
import { getTimeZoneOptions, normalizeTimeZone } from '@/lib/timezones';
import {
  getGeofencePremiumBannerCopy,
  useWorkspaceSubscriptionClient,
} from '@/lib/workspace-subscription-client';
import { recoverWorkspaceScopeViolation, workspaceFetch } from '@/lib/workspace-client';

type SettingsPayload = {
  timezone: string;
  geofenceEnabled: boolean;
  geofenceRadiusMeters: number;
  minLocationAccuracyMeters: number;
  geofenceLat?: number;
  geofenceLng?: number;
  whitelistEnabled: boolean;
  whitelistIps: string[];
};

type NoticeTone = 'info' | 'success' | 'warning' | 'error';

type InlineNotice = {
  tone: NoticeTone;
  text: string;
};

function hasFiniteNumber(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value);
}

function getGeofenceValidationErrors(data: SettingsPayload) {
  const errors: string[] = [];

  if (!hasFiniteNumber(data.geofenceRadiusMeters) || data.geofenceRadiusMeters < 10) {
    errors.push('Radius geofence minimal 10 meter.');
  }

  if (
    !hasFiniteNumber(data.minLocationAccuracyMeters) ||
    data.minLocationAccuracyMeters <= 0
  ) {
    errors.push('Batas akurasi GPS harus lebih besar dari 0 meter.');
  }

  if (!data.geofenceEnabled) {
    return errors;
  }

  if (data.geofenceLat === undefined || data.geofenceLng === undefined) {
    errors.push('Latitude dan longitude wajib diisi saat geofence aktif.');
    return errors;
  }

  if (!hasFiniteNumber(data.geofenceLat) || data.geofenceLat < -90 || data.geofenceLat > 90) {
    errors.push('Latitude geofence harus berada di antara -90 dan 90.');
  }

  if (
    !hasFiniteNumber(data.geofenceLng) ||
    data.geofenceLng < -180 ||
    data.geofenceLng > 180
  ) {
    errors.push('Longitude geofence harus berada di antara -180 dan 180.');
  }

  return errors;
}

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

type GeofenceTimezoneFieldProps = {
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
};

export function GeofenceTimezoneField({
  disabled,
  value,
  onChange,
}: GeofenceTimezoneFieldProps) {
  const timezoneOptions = getTimeZoneOptions(value);

  return (
    <label className="space-y-1 sm:col-span-2">
      <span className="text-sm font-medium text-zinc-700">Timezone</span>
      <Menu>
        <MenuTrigger
          disabled={disabled}
          render={
            <Button
              variant="outline"
              className="h-10 w-full justify-between border-zinc-200 bg-white px-3 text-sm font-normal"
            />
          }
        >
          <span className="truncate">{value}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        </MenuTrigger>
        <MenuPopup align="start" className="w-[var(--anchor-width)] p-0">
          <div className="max-h-72 overflow-y-auto p-1">
            <MenuRadioGroup value={value} onValueChange={onChange}>
              {timezoneOptions.map((timezone) => (
                <MenuRadioItem key={timezone} value={timezone}>
                  {timezone}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </div>
        </MenuPopup>
      </Menu>
    </label>
  );
}

export function GeofencePanel() {
  const workspaceSubscriptionState = useWorkspaceSubscriptionClient();
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
  const [ipText, setIpText] = useState('');
  const [notice, setNotice] = useState<InlineNotice | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

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
      setData({
        ...payload,
        timezone: normalizeTimeZone(payload.timezone),
        minLocationAccuracyMeters: payload.minLocationAccuracyMeters ?? 100,
      });
      setIpText((payload.whitelistIps ?? []).join(', '));
      setInitialLoading(false);
    };

    void load();
  }, []);

  useEffect(() => {
    const load = async () => {
      setInitialLoading(true);
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
      setData({
        ...payload,
        timezone: normalizeTimeZone(payload.timezone),
        minLocationAccuracyMeters: payload.minLocationAccuracyMeters ?? 100,
      });
      setIpText((payload.whitelistIps ?? []).join(', '));
      setInitialLoading(false);
    };

    const handleWorkspaceChanged = () => {
      void load();
    };
    const handleDashboardRefresh = () => {
      void load();
    };

    window.addEventListener('workspace:changed', handleWorkspaceChanged as EventListener);
    window.addEventListener('dashboard:refresh', handleDashboardRefresh as EventListener);

    return () => {
      window.removeEventListener('workspace:changed', handleWorkspaceChanged as EventListener);
      window.removeEventListener('dashboard:refresh', handleDashboardRefresh as EventListener);
    };
  }, []);

  const geofenceValidationErrors = getGeofenceValidationErrors(data);
  const geofencePremiumBanner = getGeofencePremiumBannerCopy(
    workspaceSubscriptionState.subscription,
  );
  const geofencePremiumUnavailable =
    workspaceSubscriptionState.ready && geofencePremiumBanner !== null;
  const premiumControlsDisabled =
    loading || !workspaceSubscriptionState.ready || geofencePremiumUnavailable;
  const hasBlockingValidationErrors =
    !geofencePremiumUnavailable && geofenceValidationErrors.length > 0;
  const showsBlockingGeofenceWarning =
    data.geofenceEnabled && geofenceValidationErrors.length > 0;

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
      const body = geofencePremiumUnavailable
        ? { timezone: data.timezone }
        : {
            ...data,
            whitelistIps: ipText
              .split(',')
              .map((ip) => ip.trim())
              .filter(Boolean),
          };

      const res = await workspaceFetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
        {workspaceSubscriptionState.ready && geofencePremiumBanner ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            {geofencePremiumBanner}
          </div>
        ) : null}
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

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Lokasi geofence</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <GeofenceTimezoneField
              value={data.timezone}
              disabled={loading}
              onChange={(timezone) => setData((prev) => ({ ...prev, timezone }))}
            />
            <label className="space-y-1">
              <span className="text-sm font-medium text-zinc-700">Latitude</span>
              <Input
                type="number"
                value={data.geofenceLat ?? ''}
                disabled={premiumControlsDisabled}
                onChange={(event) =>
                  setData((prev) => ({
                    ...prev,
                    geofenceLat: event.target.value ? Number(event.target.value) : undefined,
                  }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-zinc-700">Longitude</span>
              <Input
                type="number"
                value={data.geofenceLng ?? ''}
                disabled={premiumControlsDisabled}
                onChange={(event) =>
                  setData((prev) => ({
                    ...prev,
                    geofenceLng: event.target.value ? Number(event.target.value) : undefined,
                  }))
                }
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700">Radius Geofence (meter)</span>
              <Input
                type="number"
                min={10}
                value={data.geofenceRadiusMeters}
                disabled={premiumControlsDisabled}
                onChange={(event) =>
                  setData((prev) => ({
                    ...prev,
                    geofenceRadiusMeters: Math.max(10, Number(event.target.value) || 10),
                  }))
                }
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700">
                Batas Akurasi GPS Maksimum (meter)
              </span>
              <Input
                type="number"
                min={1}
                value={data.minLocationAccuracyMeters}
                disabled={premiumControlsDisabled}
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
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-900 sm:col-span-2">
                {geofenceValidationErrors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            ) : null}
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
                disabled={premiumControlsDisabled}
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
                disabled={premiumControlsDisabled}
                onChange={(event) =>
                  setData((prev) => ({ ...prev, whitelistEnabled: event.target.checked }))
                }
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-zinc-700">Whitelist IP (pisahkan koma)</span>
              <Input
                value={ipText}
                disabled={premiumControlsDisabled}
                onChange={(event) => setIpText(event.target.value)}
              />
            </label>
          </div>
        </article>
      </section>

      <div className="sticky bottom-20 z-10 flex items-center justify-end gap-3 rounded-xl border border-zinc-200 bg-white/95 p-4 shadow-sm backdrop-blur md:bottom-3">
        <Button
          type="submit"
          disabled={loading || !workspaceSubscriptionState.ready || hasBlockingValidationErrors}
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
