'use client';

import { FormEvent, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseApiErrorResponse } from '@/lib/client-error';
import { recoverWorkspaceScopeViolation, workspaceFetch } from '@/lib/workspace-client';

type SettingsPayload = {
  timezone: string;
  geofenceEnabled: boolean;
  geofenceRadiusMeters: number;
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

export function GeofencePanel() {
  const [data, setData] = useState<SettingsPayload>({
    timezone: 'Asia/Jakarta',
    geofenceEnabled: false,
    geofenceRadiusMeters: 100,
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
      setData(payload);
      setIpText((payload.whitelistIps ?? []).join(', '));
      setInitialLoading(false);
    };

    void load();
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
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
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700">Timezone</span>
              <Input
                value={data.timezone}
                onChange={(event) => setData((prev) => ({ ...prev, timezone: event.target.value }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-zinc-700">Latitude</span>
              <Input
                type="number"
                value={data.geofenceLat ?? ''}
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
                onChange={(event) =>
                  setData((prev) => ({
                    ...prev,
                    geofenceRadiusMeters: Math.max(10, Number(event.target.value) || 10),
                  }))
                }
              />
            </label>
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
      </section>

      <div className="sticky bottom-20 z-10 flex items-center justify-end gap-3 rounded-xl border border-zinc-200 bg-white/95 p-4 shadow-sm backdrop-blur md:bottom-3">
        <Button
          type="submit"
          disabled={loading}
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
