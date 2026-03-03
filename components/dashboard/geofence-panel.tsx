'use client';

import { FormEvent, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseApiErrorResponse } from '@/lib/client-error';

type SettingsPayload = {
  timezone: string;
  geofenceEnabled: boolean;
  geofenceRadiusMeters: number;
  geofenceLat?: number;
  geofenceLng?: number;
  whitelistEnabled: boolean;
  whitelistIps: string[];
};

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
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' });
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res, 'Gagal memuat data geofence.');
        setMessage(`[${parsed.code}] ${parsed.message}`);
        return;
      }

      const payload = (await res.json()) as SettingsPayload;
      setData(payload);
      setIpText((payload.whitelistIps ?? []).join(', '));
    };

    void load();
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const whitelistIps = ipText
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);

    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, whitelistIps }),
    });

    if (!res.ok) {
      const parsed = await parseApiErrorResponse(res, 'Gagal menyimpan pengaturan geofence.');
      setMessage(`[${parsed.code}] ${parsed.message}`);
      setLoading(false);
      return;
    }

    setLoading(false);
    setMessage('Pengaturan geofence berhasil disimpan.');
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Lokasi Geofence</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Timezone</span>
              <Input
                value={data.timezone}
                onChange={(event) => setData((prev) => ({ ...prev, timezone: event.target.value }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Latitude</span>
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
              <span className="text-sm font-medium text-slate-700">Longitude</span>
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
              <span className="text-sm font-medium text-slate-700">Radius Geofence (meter)</span>
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

        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Aturan Tambahan</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-800">Aktifkan Geofence</p>
                <p className="text-xs text-slate-500">Scan harus berada dalam radius kantor.</p>
              </div>
              <input
                type="checkbox"
                checked={data.geofenceEnabled}
                onChange={(event) =>
                  setData((prev) => ({ ...prev, geofenceEnabled: event.target.checked }))
                }
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-800">Aktifkan IP Whitelist</p>
                <p className="text-xs text-slate-500">Hanya IP kantor yang diizinkan untuk scan.</p>
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
              <span className="text-sm font-medium text-slate-700">Whitelist IP (pisahkan koma)</span>
              <Input value={ipText} onChange={(event) => setIpText(event.target.value)} />
            </label>
          </div>
        </article>
      </section>

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <Button type="submit" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
        </Button>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </form>
  );
}